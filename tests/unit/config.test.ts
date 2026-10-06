import { describe, expect, it } from 'vitest'
import { composeGlossary, GlossaryConfigSchema, EXTENSION_KEY } from '../../shared/config'
import { messages } from '../../i18n/messages'
import { translateGcsExtensionMessage } from '@gcs-ssc/extensions'
import { guardGlossaryConfiguration } from '../../server/configuration-guard'
import type { GcsExtensionConfigurationGuardContext } from '@gcs-ssc/extensions/server'

const glossary = (english: string, french: string) => ({ glossary: [{ english, french }] })
describe('scoped glossaries', () => {
  it('defaults to no terms and trims entries', () => {
    expect(GlossaryConfigSchema.parse({})).toEqual({ version: 1, glossary: [] })
    expect(GlossaryConfigSchema.parse(glossary(' Hello ', ' Bonjour ')).glossary[0]).toEqual({ english: 'Hello', french: 'Bonjour' })
    expect(composeGlossary(undefined, undefined, 'en-fr')).toEqual([])
  })
  it.each([{ glossary: [{ english: '', french: 'bonjour' }] }, { glossary: [{ english: 'hello', french: '' }] }, { version: 2 }, { other: true }, { glossary: [{ english: 'a'.repeat(251), french: 'oui' }] }, { glossary: Array.from({ length: 501 }, (_, i) => ({ english: String(i), french: String(i) })) }, { glossary: [{ english: 'HELLO', french: 'bonjour' }, { english: 'hello', french: 'salut' }] }, { glossary: [{ english: 'hello', french: 'BONJOUR' }, { english: 'hi', french: 'bonjour' }] }])('rejects malformed or ambiguous configuration %j', value => {
    expect(GlossaryConfigSchema.safeParse(value).success).toBe(false)
  })
  it('overrides matching source terms independently in each direction', () => {
    expect(composeGlossary(glossary('Grant', 'Subvention'), glossary('grant', 'Contribution'), 'en-fr')).toEqual([{ english: 'grant', french: 'Contribution', enabled: true }])
    expect(composeGlossary(glossary('Grant', 'Subvention'), glossary('Funding', 'subvention'), 'fr-en')).toEqual([{ english: 'Funding', french: 'subvention', enabled: true }])
    expect(composeGlossary(glossary('Grant', 'Subvention'), glossary('grant', 'Contribution'), 'fr-en')).toHaveLength(2)
  })
  it('owns its bilingual messages and literal placeholders', () => {
    for (const locale of ['en', 'fr']) for (const key of Object.keys(messages.en)) {
      expect(translateGcsExtensionMessage(messages, locale, key as keyof typeof messages.en, { number: 1, term: 'grant' })).toBeTruthy()
    }
    expect(translateGcsExtensionMessage(messages, 'fr-CA', 'toEnglish')).toBe('Traduire en anglais')
  })
  it('guards both scopes and ignores unrelated or omitted configuration', () => {
    const context = { targetExtensionKey: EXTENSION_KEY, config: {} } as GcsExtensionConfigurationGuardContext
    for (const scope of ['agency', 'stream'] as const) {
      expect(() => guardGlossaryConfiguration({ ...context, scope })).not.toThrow()
      expect(() => guardGlossaryConfiguration({ ...context, scope, config: { version: 2 } })).toThrow()
    }
    expect(() => guardGlossaryConfiguration({ ...context, targetExtensionKey: 'another', config: { invalid: true } })).not.toThrow()
    expect(() => guardGlossaryConfiguration({ ...context, config: undefined })).not.toThrow()
  })
})
