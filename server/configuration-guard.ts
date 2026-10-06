import { createGcsExtensionUserError, defineGcsExtensionNitroPlugin, registerGcsExtensionConfigurationGuard } from '@gcs-ssc/extensions/server'
import type { GcsExtensionConfigurationGuardContext } from '@gcs-ssc/extensions/server'
import { EXTENSION_KEY, GlossaryConfigSchema } from '../shared/config'
import { messages } from '../i18n/messages'

/** Validates both configuration scopes inside the existing host transaction.
 * @param context Host-authorized configuration write.
 */
export const guardGlossaryConfiguration = (context: GcsExtensionConfigurationGuardContext): void => {
  if (context.targetExtensionKey !== EXTENSION_KEY || context.config === undefined) return
  if (!GlossaryConfigSchema.safeParse(context.config).success) throw createGcsExtensionUserError({
    statusCode: 400, code: 'INVALID_TRANSLATION_GLOSSARY', message: { en: messages.en.invalid, fr: messages.fr.invalid }
  })
}
export default defineGcsExtensionNitroPlugin(app => {
  registerGcsExtensionConfigurationGuard(EXTENSION_KEY, guardGlossaryConfiguration, app)
})
