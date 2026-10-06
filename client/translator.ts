import { createTranslator } from 'nmt-enfr'
import type { Direction, GlossaryEntry } from 'nmt-enfr'

/** One cancellable worker session per action; only model assets enter the browser cache.
 * @param text Source text.
 * @param direction Explicit source and target languages.
 * @param glossary Composed agency and stream terms.
 * @returns Cancellable translation operation.
 */
export const startTranslation = (text: string, direction: Direction, glossary: GlossaryEntry[]) => {
  const base = '/extensions/gcs-machine-translation'
  const client = createTranslator({
    workerUrl: `${base}/nmt/worker.js`,
    transformersUrl: `${base}/transformers/transformers.min.js`,
    wasmBaseUrl: `${base}/ort/`,
    // Chrome exposes Cache Storage only on secure origins (including localhost).
    // Plain HTTP LAN development must still be able to load models without it.
    maxWorkers: 1, useBrowserCache: typeof globalThis.caches !== 'undefined', useFSCache: false, allowLocalModels: false
  })
  let rejectCancellation: (reason: Error) => void = () => {}
  const cancellation = new Promise<never>((_resolve, reject) => {
    rejectCancellation = reject
  })
  return {
    result: Promise.race([client.translateText(text, { direction, glossary }), cancellation]).finally(() => client.dispose()),
    /** Cancels translation and releases the worker even during model loading. */
    cancel: () => {
      rejectCancellation(new Error('Translation cancelled'))
      client.cancel()
      client.dispose()
    }
  }
}
