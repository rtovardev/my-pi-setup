const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
// Runtime installs omit dev/peer dependencies; tests may use the installed Pi host.
const moduleRoot = process.env.PI_TEST_HOST_ROOT || path.resolve(__dirname, '../node_modules');
const hostRequire = createRequire(path.join(moduleRoot, 'package.json'));
const { createJiti } = hostRequire('jiti');
const jiti = createJiti(__filename, { moduleCache: true, alias: {
  ...Object.fromEntries(['@earendil-works/pi-coding-agent', '@earendil-works/pi-tui', '@earendil-works/pi-ai']
    .map(name => [name, path.join(moduleRoot, name, 'dist/index.js')])),
  typebox: hostRequire.resolve('typebox'),
} });
const root = path.resolve(__dirname, '..');
const load = name => jiti.import(path.join(root, 'src', name));
const publicRequest = (key = 'https://unlisted-public.invalid') => ({ scope: 'fetch_markdown', key, label: 'Confirm?', sessionPermissions: new Map(), durable: true });
const noUI = { hasUI: false, ui: { select() { throw new Error('Unexpected permission dialog'); } } };

function register(factory) {
  const tools = new Map();
  const hooks = new Map();
  factory({ registerTool(tool) { tools.set(tool.name, tool); }, registerCommand() {}, on(name, cb) { hooks.set(name, cb); } });
  return { tools, hooks };
}

function minimalPdf() {
  const stream = 'BT /F1 12 Tf 72 720 Td (Hello harness) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf));
}

(async () => {
  const permissions = await load('permission-prompt.ts');
  const fetcher = await load('fetch-markdown.ts');
  const workers = await load('content-workers.ts');
  const pdfModule = await load('pdf-extract.ts');
  const originalFetch = global.fetch;

  test('public fetch and PDF reads and navigation do not ask per-host permission, even without UI', async () => {
    for (const scope of ['fetch_markdown', 'pdf_extract', 'web_browser']) {
      for (const key of ['https://first-public.invalid', 'https://second-public.invalid']) {
        assert.deepEqual(await permissions.requestHostPermission(noUI, { ...publicRequest(key), scope }), { allowed: true });
      }
    }
  });
  test('explicit session denial is not overridden by public-read policy', async () => {
    const req = publicRequest(); req.sessionPermissions.set(req.key, 'deny');
    assert.equal((await permissions.requestHostPermission(noUI, req)).allowed, false);
  });
  test('private/local origins and local files still require confirmation', async () => {
    for (const key of ['http://127.0.0.1', 'http://10.0.0.1', 'http://192.168.1.1', 'http://localhost', 'http://thing.local', 'http://[::ffff:10.0.0.1]', 'file:///tmp/private.pdf']) {
      assert.equal((await permissions.requestHostPermission(noUI, { ...publicRequest(key), durable: !key.startsWith('file:') })).allowed, false, key);
    }
  });
  test('local permission dialog receives a deadline and settles on turn cancellation', async () => {
    const controller = new AbortController(); let received;
    const req = { ...publicRequest('file:///tmp/private.pdf'), durable: false };
    const ctx = { hasUI: true, signal: controller.signal, ui: { select(_label, _options, options) {
      received = options;
      return new Promise(resolve => options.signal.addEventListener('abort', () => resolve(undefined), { once: true }));
    } } };
    const pending = permissions.requestHostPermission(ctx, req);
    setTimeout(() => controller.abort(), 10);
    const result = await pending;
    assert.equal(result.allowed, false); assert.match(result.reason, /cancelled/);
    assert.equal(received.timeout, 15_000); assert.equal(req.sessionPermissions.size, 0);
  });
  test('dismissed or expired permission does not persist a denial', async () => {
    const req = { ...publicRequest('file:///tmp/private.pdf'), durable: false };
    const result = await permissions.requestHostPermission({ hasUI: true, ui: { select: async () => undefined } }, req);
    assert.match(result.reason, /timed out/); assert.equal(req.sessionPermissions.size, 0);
  });
  test('already-cancelled turn is blocked before prompting or granting', async () => {
    const result = await permissions.requestHostPermission({ ...noUI, signal: AbortSignal.abort() }, publicRequest());
    assert.equal(result.allowed, false); assert.match(result.reason, /cancelled/);
  });
  test('bundled HTML excludes script/template/style payloads and remains useful in raw mode', async () => {
    const html = `<h1>Public article</h1><p>Visible text</p><script>${'BASE64'.repeat(150000)}</script><template>SECRET TEMPLATE</template><style>.secret{}</style>`;
    const start = performance.now();
    const markdown = await workers.convertHtmlInWorker(html, true);
    assert.match(markdown, /Public article/); assert.match(markdown, /Visible text/);
    assert.doesNotMatch(markdown, /BASE64|SECRET TEMPLATE|secret/);
    assert.ok(performance.now() - start < 4000);
  });
  test('CPU conversion worker has a hard deadline and is terminated', async () => {
    const start = performance.now();
    await assert.rejects(workers.convertHtmlInWorker('<h1>Article</h1>', true, undefined, 1), /timed out.*worker terminated/);
    assert.ok(performance.now() - start < 1000);
  });
  test('in-progress conversion worker can be cancelled', async () => {
    const controller = new AbortController();
    const pending = workers.convertHtmlInWorker('<p>text</p>', true, controller.signal);
    controller.abort(new Error('test conversion cancelled'));
    await assert.rejects(pending, /test conversion cancelled/);
  });
  test('PDF extraction runs in a worker and returns the page text', async () => {
    const result = await workers.extractPdfInWorker(minimalPdf());
    assert.equal(result.totalPages, 1); assert.match(result.pages[0], /Hello harness/);
  });
  test('registered fetch tool reads unlisted public host and uses cache without additional requests', async () => {
    fetcher.clearWebFetchCache(); let requests = 0;
    global.fetch = async () => { requests++; return new Response('<h1>Harness result</h1><p>Public page</p>', { headers: { 'content-type': 'text/html' } }); };
    try {
      const { tools, hooks } = register(fetcher.default);
      assert.equal(await hooks.get('tool_call')({ toolName: 'fetch_markdown', input: { url: 'https://normal-public.invalid' } }, noUI), undefined);
      const tool = tools.get('fetch_markdown');
      const first = await tool.execute('1', { url: 'https://normal-public.invalid', raw: true }, undefined);
      const second = await tool.execute('2', { url: 'https://normal-public.invalid', raw: true }, undefined);
      assert.match(first.content[0].text, /Harness result/); assert.equal(second.details.cached, true); assert.equal(requests, 1);
    } finally { global.fetch = originalFetch; fetcher._cleanup(); }
  });
  test('cross-origin redirect remains explicit and no hidden follow-up request occurs', async () => {
    global.fetch = async () => new Response(null, { status: 301, headers: { location: 'https://different-public.invalid/page' } });
    try {
      const result = await fetcher.getURLMarkdownContent('https://redirect-public.invalid');
      assert.equal(result.type, 'redirect'); assert.equal(result.redirectUrl, 'https://different-public.invalid/page');
    } finally { global.fetch = originalFetch; fetcher._cleanup(); }
  });
  test('private fetch targets are rejected before any network request', async () => {
    let requests = 0; global.fetch = async () => { requests++; throw new Error('Unexpected network'); };
    try {
      await assert.rejects(fetcher.getURLMarkdownContent('https://127.0.0.1/secret'), /Invalid URL/);
      assert.equal(requests, 0);
    } finally { global.fetch = originalFetch; }
  });
  test('HTML responses above 2 MiB fail promptly without conversion', async () => {
    global.fetch = async () => new Response('x'.repeat(2 * 1024 * 1024 + 1), { headers: { 'content-type': 'text/html' } });
    try { await assert.rejects(fetcher.getURLMarkdownContent('https://large-public.invalid'), /Response too large/); }
    finally { global.fetch = originalFetch; fetcher._cleanup(); }
  });
  test('session shutdown cancels a pending response body, not only the header request', async () => {
    let started;
    const bodyStarted = new Promise(resolve => { started = resolve; });
    global.fetch = async (_url, options) => new Response(new ReadableStream({ start(controller) {
      options.signal.addEventListener('abort', () => controller.error(options.signal.reason), { once: true });
      started();
    } }), { headers: { 'content-type': 'text/plain' } });
    try {
      const pending = fetcher.getURLMarkdownContent('https://stalled-body.invalid');
      await bodyStarted;
      assert.equal(fetcher._activeFetchCountForTests(), 1);
      fetcher._cleanup(); await assert.rejects(pending);
      assert.equal(fetcher._activeFetchCountForTests(), 0);
    } finally { global.fetch = originalFetch; fetcher._cleanup(); }
  });
  test('browser markdown conversion uses the cancellable HTML worker', async () => {
  const { BrowserManager } = await load('web-browser/browser-manager.ts');
  const manager = new BrowserManager();
  manager.ensureLaunched = async () => {};
  manager.page = {
    waitForLoadState: async () => {},
    evaluate: async () => '<h1>Browser worker</h1><script>hidden payload</script><p>Visible text</p>',
  };
  const markdown = await manager.getMarkdown();
  assert.match(markdown, /Browser worker/);
  assert.match(markdown, /Visible text/);
  assert.doesNotMatch(markdown, /hidden payload/);
});

test('registered PDF tool downloads and extracts without a per-host dialog', async () => {
    global.fetch = async () => new Response(minimalPdf(), { headers: { 'content-type': 'application/pdf' } });
    try {
      const { tools, hooks } = register(pdfModule.default);
      assert.equal(await hooks.get('tool_call')({ toolName: 'pdf_extract', input: { url: 'https://pdf-public.invalid/file.pdf' } }, noUI), undefined);
      const result = await tools.get('pdf_extract').execute('pdf1', { url: 'https://pdf-public.invalid/file.pdf' }, undefined);
      assert.match(result.content[0].text, /Hello harness/);
    } finally { global.fetch = originalFetch; pdfModule._cleanup(); }
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
