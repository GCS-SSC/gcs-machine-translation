import { defineGcsAuditOwnership, defineGcsExtension } from '@gcs-ssc/extensions'

export default defineGcsExtension({
  key: 'gcs-machine-translation', sdkVersion: '^0.3.9',
  name: { en: 'Machine translation', fr: 'Traduction automatique' },
  description: {
    en: 'Translate paired English and French fields with agency and stream glossaries.',
    fr: 'Traduisez les champs anglais et français avec les glossaires de l’agence et du volet.'
  },
  requiredHostCapabilities: ['agency-config', 'stream-config-modal', 'bilingual-field-slots', 'extension-ui', 'public-assets', 'extension-lifecycle-hooks', 'audit-ownership'],
  auditOwnership: defineGcsAuditOwnership([]),
  admin: {
    agency: { path: './components/GlossaryConfig.vue' },
    streamConfig: { path: './components/GlossaryConfig.vue' }
  },
  client: { slots: [{ slot: 'bilingual-field.after', path: './components/TranslateField.vue' }] },
  nitroPlugin: './server/configuration-guard.ts',
  assets: [
    { path: './public/licenses', baseURL: '/extensions/gcs-machine-translation/licenses' },
    { package: 'nmt-enfr', packagePath: 'dist', baseURL: '/extensions/gcs-machine-translation/nmt' },
    { package: '@huggingface/transformers', packagePath: 'dist', baseURL: '/extensions/gcs-machine-translation/transformers' },
    { package: 'onnxruntime-web', packagePath: 'dist', baseURL: '/extensions/gcs-machine-translation/ort' }
  ]
})
