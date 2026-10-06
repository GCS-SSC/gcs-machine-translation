import { beforeEach, describe, expect, it, vi } from 'vitest'
import { startTranslation } from '../../client/translator'

const { create, translate, cancel, dispose } = vi.hoisted(() => ({ create: vi.fn(), translate: vi.fn(), cancel: vi.fn(), dispose: vi.fn() }))
vi.mock('nmt-enfr', () => ({ createTranslator: create }))

beforeEach(() => {
  vi.clearAllMocks()
  create.mockReturnValue({ translateText: translate, cancel, dispose })
})
describe('library worker lifecycle', () => {
  it('passes both direction and glossary to the actual library API and disposes workers', async () => {
    translate.mockResolvedValue({ text: 'Bonjour' })
    const glossary = [{ english: 'Hello', french: 'Bonjour' }]
    expect(await startTranslation('Hello', 'en-fr', glossary).result).toEqual({ text: 'Bonjour' })
    expect(translate).toHaveBeenCalledWith('Hello', { direction: 'en-fr', glossary })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ workerUrl: '/extensions/gcs-machine-translation/nmt/worker.js', transformersUrl: '/extensions/gcs-machine-translation/transformers/transformers.min.js', wasmBaseUrl: '/extensions/gcs-machine-translation/ort/', maxWorkers: 1, useBrowserCache: true, useFSCache: false, allowLocalModels: false }))
    expect(dispose).toHaveBeenCalledTimes(1)
  })
  it('releases resources after failure', async () => {
    translate.mockRejectedValue(new Error('offline'))
    await expect(startTranslation('Bonjour', 'fr-en', []).result).rejects.toThrow('offline')
    expect(dispose).toHaveBeenCalled()
  })
  it('cancels even while a model download has not resolved', async () => {
    translate.mockReturnValue(new Promise(() => {}))
    const operation = startTranslation('Hello', 'en-fr', [])
    operation.cancel()
    await expect(operation.result).rejects.toThrow('cancelled')
    expect(cancel).toHaveBeenCalled()
    expect(dispose).toHaveBeenCalled()
  })
})
