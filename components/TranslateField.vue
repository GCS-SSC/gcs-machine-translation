<script setup lang="ts">

import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import type { GcsBilingualFieldExtensionContext, GcsExtensionJsonConfig } from '@gcs-ssc/extensions'
import { ExtensionAlert, ExtensionButton, ExtensionFormField, ExtensionIcon, ExtensionModal, ExtensionSelect, useExtensionI18n } from '@gcs-ssc/extensions/ui'
import { composeGlossary } from '../shared/config'
import { startTranslation } from '../client/translator'
import { messages } from '../i18n/messages'

const { context, config } = defineProps<{ context: GcsBilingualFieldExtensionContext; config: GcsExtensionJsonConfig }>()
const { t, locale } = useExtensionI18n(messages)
type Snapshot = { context: GcsBilingualFieldExtensionContext; source: string; target: string }
type Action = { kind: 'idle' | 'done' | 'failed' | 'stale' } | { kind: 'pending'; session: ReturnType<typeof startTranslation> }
type Dialog = { kind: 'closed' | 'disposed' } | { kind: 'open'; snapshot: Snapshot; agencyId: string; action: Action }
const dialog: Ref<Dialog> = shallowRef({ kind: 'closed' })
const open = computed(() => dialog.value.kind === 'open')
const status = computed(() => dialog.value.kind === 'open' ? dialog.value.action.kind : 'idle')
const needsOverwrite = computed(() => dialog.value.kind === 'open' && Boolean(dialog.value.snapshot.target.trim()))
const agencyId = computed({
  get: () => dialog.value.kind === 'open' ? dialog.value.agencyId : '',
  set: (value: string) => { if (dialog.value.kind === 'open') dialog.value = { ...dialog.value, agencyId: value } }
})
const label = computed(() => t(context.target.locale === 'fr' ? 'toFrench' : 'toEnglish'))
const agencies = computed(() => context.agencies ?? [])
const agencyOptions = computed(() => agencies.value.map(agency => ({ value: agency.agencyId, label: locale.value.startsWith('fr') ? agency.nameFr : agency.nameEn })))
const close = () => {
  if (dialog.value.kind === 'disposed') return
  if (dialog.value.kind === 'open' && dialog.value.action.kind === 'pending') dialog.value.action.session.cancel()
  dialog.value = { kind: 'closed' }
}
const translate = async () => {
  const active = dialog.value
  if (active.kind !== 'open' || active.action.kind === 'pending' || (agencies.value.length > 0 && !active.agencyId)) return
  try {
    const direction = active.snapshot.context.source.locale === 'en' ? 'en-fr' : 'fr-en'
    const selected = agencies.value.find(agency => agency.agencyId === active.agencyId)
    const runtime = selected?.config ?? config
    const glossary = composeGlossary(runtime.agency, runtime.stream, direction)
    const session = startTranslation(active.snapshot.source, direction, glossary)
    const pending: Dialog = { ...active, action: { kind: 'pending', session } }
    dialog.value = pending
    try {
      const result = await session.result
      if (dialog.value !== pending) return
      const snapshot = active.snapshot
      const kind = snapshot.context.applyTranslation(result.text, { source: snapshot.source, target: snapshot.target }) ? 'done' : 'stale'
      dialog.value = { ...active, action: { kind } }
    } catch {
      if (dialog.value === pending) dialog.value = { ...active, action: { kind: 'failed' } }
    }
  } catch {
    if (dialog.value === active) dialog.value = { ...active, action: { kind: 'failed' } }
  }
}
const begin = () => {
  if (dialog.value.kind === 'disposed' || !context.source.isEditable() || !context.target.isEditable() || !context.source.getText().trim()) return
  close()
  const snapshot = { context, source: context.source.getText(), target: context.target.getText() }
  dialog.value = { kind: 'open', snapshot, agencyId: agencies.value.length === 1 ? agencies.value[0]!.agencyId : '', action: { kind: 'idle' } }
  if (!needsOverwrite.value && agencies.value.length <= 1) void translate()
}
watch(() => context, close, { flush: 'sync' })
onBeforeUnmount(() => { close(); dialog.value = { kind: 'disposed' } })
</script>

<template>
  <div class="mt-1" data-field-scope="extension.gcs-machine-translation.translate-field">
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
