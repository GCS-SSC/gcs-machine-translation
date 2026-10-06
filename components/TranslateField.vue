<script setup lang="ts">
/* eslint-disable jsdoc/require-jsdoc -- Local UI actions use the public SDK contracts. */
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Ref } from 'vue'
import type { GcsBilingualFieldExtensionContext, GcsExtensionJsonConfig } from '@gcs-ssc/extensions'
import { ExtensionAlert, ExtensionButton, ExtensionFormField, ExtensionIcon, ExtensionModal, ExtensionSelect, useExtensionI18n } from '@gcs-ssc/extensions/ui'
import { composeGlossary } from '../shared/config'
import { startTranslation } from '../client/translator'
import { messages } from '../i18n/messages'

const { context, config } = defineProps<{ context: GcsBilingualFieldExtensionContext; config: GcsExtensionJsonConfig }>()
const { t, locale } = useExtensionI18n(messages)
const open: Ref<boolean> = ref(false)
const status: Ref<'idle' | 'pending' | 'done' | 'failed' | 'stale'> = ref('idle')
const agencyId: Ref<string> = ref('')
const needsOverwrite: Ref<boolean> = ref(false)
let session: ReturnType<typeof startTranslation> | null = null
let generation = 0
let snapshot: { context: GcsBilingualFieldExtensionContext; source: string; target: string } | null = null
const label = computed(() => t(context.target.locale === 'fr' ? 'toFrench' : 'toEnglish'))
const agencies = computed(() => context.agencies ?? [])
const agencyOptions = computed(() => agencies.value.map(agency => ({ value: agency.agencyId, label: locale.value.startsWith('fr') ? agency.nameFr : agency.nameEn })))
const close = () => {
  generation += 1
  session?.cancel()
  session = null
  snapshot = null
  status.value = 'idle'
  open.value = false
}
const translate = async () => {
  if (!snapshot || status.value === 'pending' || (agencies.value.length > 0 && !agencyId.value)) return
  const active = snapshot
  const request = ++generation
  status.value = 'pending'
  try {
    const direction = active.context.source.locale === 'en' ? 'en-fr' : 'fr-en'
    const selected = agencies.value.find(agency => agency.agencyId === agencyId.value)
    const runtime = selected?.config ?? config
    const glossary = composeGlossary(runtime.agency, runtime.stream, direction)
    session = startTranslation(active.source, direction, glossary)
    const result = await session.result
    if (request !== generation) return
    status.value = active.context.applyTranslation(result.text, { source: active.source, target: active.target }) ? 'done' : 'stale'
  } catch {
    if (request === generation) status.value = 'failed'
  } finally {
    if (request === generation) session = null
  }
}
const begin = () => {
  if (!context.source.isEditable() || !context.target.isEditable() || !context.source.getText().trim()) return
  snapshot = { context, source: context.source.getText(), target: context.target.getText() }
  needsOverwrite.value = Boolean(snapshot.target.trim())
  agencyId.value = agencies.value.length === 1 ? agencies.value[0]!.agencyId : ''
  status.value = 'idle'
  open.value = true
  if (!needsOverwrite.value && agencies.value.length <= 1) void translate()
}
onBeforeUnmount(close)
</script>

<template>
  <div class="mt-1">
    <ExtensionButton
      type="button" color="neutral" variant="outline" size="xs" class="font-medium normal-case tracking-normal" :label="label"
      :disabled="status === 'pending' || !context.source.getText().trim() || !context.source.isEditable() || !context.target.isEditable()" @click="begin" />
    <ExtensionModal :open="open" :title="t('title')" :description="t('notice')" @update:open="(value: boolean) => { if (!value) close() }">
      <template #body>
        <div class="space-y-4">
          <template v-if="status === 'idle'">
            <ExtensionFormField v-if="agencies.length > 1" name="translationAgency" :label="t('chooseAgency')" :description="t('agencyHelpTranslation')" required>
              <ExtensionSelect v-model="agencyId" :items="agencyOptions" />
            </ExtensionFormField>
            <p v-if="needsOverwrite" class="text-sm">
              {{ t('overwrite') }}
            </p>
            <ExtensionButton :label="needsOverwrite ? t('start') : label" :disabled="agencies.length > 0 && !agencyId" @click="translate" />
          </template>
          <div v-if="status === 'pending'" role="status" aria-live="polite" class="flex items-center gap-3">
            <ExtensionIcon name="i-lucide-loader-circle" class="size-5 shrink-0 animate-spin" aria-hidden="true" />
            <p class="text-sm">
              {{ t('loading') }}
            </p>
          </div>
          <ExtensionAlert v-if="status === 'done'" color="success" :title="t('done')" />
          <ExtensionAlert v-if="status === 'failed' || status === 'stale'" color="warning" :title="t(status)" />
        </div>
      </template>
      <template #footer>
        <ExtensionButton color="neutral" variant="ghost" :label="t(status === 'pending' || status === 'idle' ? 'cancel' : 'close')" @click="close" />
      </template>
    </ExtensionModal>
  </div>
</template>
