const { parentPort, workerData } = require('node:worker_threads');

async function main() {
  if (workerData.kind === 'pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(workerData.bytes), { maxImageSize: 16_777_216 });
    try {
      if (pdf.numPages > 2000) throw new Error(`PDF has too many pages (${pdf.numPages} exceeds 2000).`);
      const { totalPages, text } = await extractText(pdf, { mergePages: false });
      return { pages: Array.isArray(text) ? text : [text], totalPages };
    } finally {
      await pdf.loadingTask.destroy();
    }
  }

  const { Readability } = require('@mozilla/readability');
  const { parseHTML } = require('linkedom');
  const TurndownService = require('turndown');
  // Script/style/template payloads are not visible article content. Remove them
  // before DOM construction so embedded bundles/base64 cannot dominate parsing.
  const html = workerData.html.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  let source = html;
  if (!workerData.raw) {
    try {
      const { document } = parseHTML(html);
      const article = new Readability(document).parse();
      if (article?.content && (article.textContent?.trim().length ?? 0) >= 250) {
        const title = article.title?.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        source = title ? `<h1>${title}</h1>${article.content}` : article.content;
      }
    } catch {
      // Fall back to the sanitized complete page, still inside the bounded worker.
    }
  }
  const converter = new TurndownService();
  converter.remove(['script', 'style', 'template']);
  return converter.turndown(source);
}

main().then(
  value => parentPort.postMessage({ ok: true, value }),
  error => parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }),
);
