import { Worker } from "node:worker_threads";

const WORKER_URL = new URL("./content-worker.cjs", import.meta.url);

function runContentWorker<T>(
  workerData: Record<string, unknown>,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<T> {
  signal?.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const worker = new Worker(WORKER_URL, {
      workerData,
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 },
    });
    let settled = false;
    const finish = (error?: Error, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      // Terminate on success as well: PDF dependencies may retain handles.
      void worker.terminate().catch(() => {});
      if (error) reject(error);
      else resolve(value as T);
    };
    const onAbort = () => finish(signal?.reason instanceof Error ? signal.reason : new Error("Content processing cancelled."));
    const timer = setTimeout(() => finish(new Error(`Content processing timed out after ${timeoutMs}ms; worker terminated.`)), timeoutMs);
    worker.once("message", (message: { ok: boolean; value?: T; error?: string }) => {
      finish(message.ok ? undefined : new Error(message.error ?? "Content processing failed."), message.value);
    });
    worker.once("error", error => finish(error instanceof Error ? error : new Error(String(error))));
    worker.once("exit", code => {
      if (!settled) finish(new Error(`Content worker exited before returning a result (code ${code}).`));
    });
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

export function convertHtmlInWorker(html: string, raw: boolean, signal?: AbortSignal, timeoutMs = 10_000): Promise<string> {
  return runContentWorker<string>({ kind: "html", html, raw }, signal, timeoutMs);
}

export function extractPdfInWorker(bytes: Uint8Array, signal?: AbortSignal): Promise<{ pages: string[]; totalPages: number }> {
  return runContentWorker({ kind: "pdf", bytes }, signal, 30_000);
}
