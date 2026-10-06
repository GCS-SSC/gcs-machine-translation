import { z } from 'zod'
import type { Direction, GlossaryEntry } from 'nmt-enfr'

export const EXTENSION_KEY = 'gcs-machine-translation'
const term = z.string().trim().min(1).max(250)
export const GlossaryConfigSchema = z.object({
  version: z.literal(1).default(1),
  glossary: z.array(z.object({ english: term, french: term })).max(500).default([])
}).strict().superRefine((config, context) => {
  for (const language of ['english', 'french'] as const) {
    const seen = new Set<string>()
    config.glossary.forEach((entry, index) => {
      const key = entry[language].toLocaleLowerCase(language === 'english' ? 'en' : 'fr')
      if (seen.has(key)) context.addIssue({ code: 'custom', path: ['glossary', index, language], message: 'invalid' })
      seen.add(key)
    })
  }
})
export type GlossaryConfig = z.infer<typeof GlossaryConfigSchema>

/** Composes the two scopes by source term in the requested direction.
 * @param agency Agency configuration.
 * @param stream Optional stream configuration.
 * @param direction Explicit source and target languages.
 * @returns Active library glossary entries with stream precedence.
 */
export const composeGlossary = (agency: unknown, stream: unknown, direction: Direction): GlossaryEntry[] => {
  const agencyConfig = GlossaryConfigSchema.parse(agency ?? {})
  const streamConfig = GlossaryConfigSchema.parse(stream ?? {})
  const source = direction === 'en-fr' ? 'english' : 'french'
  const locale = direction === 'en-fr' ? 'en' : 'fr'
  const terms = new Map<string, GlossaryEntry>()
  for (const entry of [...agencyConfig.glossary, ...streamConfig.glossary]) {
    terms.set(entry[source].toLocaleLowerCase(locale), { ...entry, enabled: true })
  }
  return [...terms.values()]
}
