<script setup lang="ts">
/* eslint-disable jsdoc/require-jsdoc -- Local UI actions use the public SDK contracts. */
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { nanoid } from 'nanoid'
import type { GcsExtensionJsonConfig } from '@gcs-ssc/extensions'
import { ExtensionAlert, ExtensionButton, ExtensionCompactTable, ExtensionFormField, ExtensionInput, ExtensionModal, ExtensionSaveButton, useExtensionI18n } from '@gcs-ssc/extensions/ui'
import { GlossaryConfigSchema } from '../shared/config'
import { messages } from '../i18n/messages'

const model = defineModel<GcsExtensionJsonConfig>({ default: () => ({}) })
const { streamId, disabled = false } = defineProps<{ streamId?: string; disabled?: boolean }>()
const { t } = useExtensionI18n(messages)
type Term = { english: string; french: string }
type Row = Term & { key: string }
const rows: Ref<Row[]> = ref([])
const draft: Ref<Term | null> = ref(null)
const editingKey: Ref<string | null> = ref(null)
const attempted = ref(false)
let lastEmitted = ''
const close = () => {
  draft.value = null
  editingKey.value = null
  attempted.value = false
}
watch(model, value => {
  const ownEcho = JSON.stringify(value) === lastEmitted
  lastEmitted = ''
  if (ownEcho) return
  close()
  const result = GlossaryConfigSchema.safeParse(value)
  rows.value = result.success ? result.data.glossary.map(entry => ({ ...entry, key: nanoid() })) : []
}, { immediate: true, deep: true })
watch(() => disabled, value => { if (value) close() })
const validation = computed(() => GlossaryConfigSchema.safeParse(model.value))
const columns = computed(() => [
  { accessorKey: 'english', header: t('english') },
  { accessorKey: 'french', header: t('french') },
  { id: 'actions', header: t('actions') }
])
const draftIndex = computed(() => editingKey.value === null ? rows.value.length : rows.value.findIndex(row => row.key === editingKey.value))
const candidate = computed(() => {
  const glossary = rows.value.map(({ key, english, french }) => key === editingKey.value && draft.value ? { ...draft.value } : { english, french })
  if (editingKey.value === null && draft.value) glossary.push({ ...draft.value })
  return { version: 1, glossary }
})
const draftValidation = computed(() => GlossaryConfigSchema.safeParse(candidate.value))
const fieldError = (language: keyof Term) => !attempted.value || draftValidation.value.success
  ? undefined
  : draftValidation.value.error.issues.some(issue => issue.path.join('.') === `glossary.${draftIndex.value}.${language}`) ? t('invalid') : undefined
const publish = () => {
  const value = { version: 1, glossary: rows.value.map(({ english, french }) => ({ english, french })) }
  lastEmitted = JSON.stringify(value)
  model.value = value
}
const edit = (row?: Row) => {
  if (disabled || (!row && rows.value.length >= 500)) return
  editingKey.value = row?.key ?? null
  draft.value = { english: row?.english ?? '', french: row?.french ?? '' }
  attempted.value = false
}
const save = () => {
  if (disabled || !draft.value) return
  if (draftIndex.value < 0) { close(); return }
  attempted.value = true
  const result = draftValidation.value
  if (!result.success) return
  const entry = result.data.glossary[draftIndex.value]!
  if (editingKey.value === null) rows.value.push({ ...entry, key: nanoid() })
  else rows.value.splice(draftIndex.value, 1, { ...entry, key: editingKey.value })
  publish()
  close()
}
const remove = (key: string) => {
  if (disabled) return
  rows.value = rows.value.filter(row => row.key !== key)
  publish()
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted">
      {{ t(streamId ? 'streamHelp' : 'agencyHelp') }}
    </p>
    <ExtensionAlert v-if="!validation.success" color="error" :title="t('invalid')" />
    <div class="flex justify-end">
      <ExtensionButton type="button" icon="i-lucide-plus" variant="outline" :label="t('add')" :disabled="disabled || rows.length >= 500" @click="edit()" />
    </div>
    <ExtensionCompactTable :data="rows" :columns="columns" :empty-text="t('empty')" :ui="{ td: 'align-top', th: 'whitespace-nowrap' }">
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-2">
          <ExtensionButton type="button" color="neutral" variant="ghost" size="sm" icon="i-lucide-pencil" :aria-label="t('edit', { term: row.original.english })" :disabled="disabled" @click="edit(row.original)" />
          <ExtensionButton type="button" color="error" variant="ghost" size="sm" icon="i-lucide-trash" :aria-label="t('remove', { number: row.index + 1 })" :disabled="disabled" @click="remove(row.original.key)" />
        </div>
      </template>
    </ExtensionCompactTable>
    <ExtensionModal :open="draft !== null" :title="t(editingKey === null ? 'add' : 'editTitle')" :description="t('termHelp')" :ui="{ content: 'sm:max-w-2xl' }" @update:open="(value: boolean) => { if (!value) close() }">
      <template #body>
        <div v-if="draft" class="space-y-4">
          <ExtensionAlert v-if="attempted && !draftValidation.success" role="alert" color="error" :title="t('invalid')" />
          <div class="grid gap-4 sm:grid-cols-2">
            <ExtensionFormField name="english" :label="t('english')" :error="fieldError('english')" required>
              <ExtensionInput v-model="draft.english" lang="en" :maxlength="250" :disabled="disabled" autofocus @keydown.enter.prevent="save" />
            </ExtensionFormField>
            <ExtensionFormField name="french" :label="t('french')" :error="fieldError('french')" required>
              <ExtensionInput v-model="draft.french" lang="fr" :maxlength="250" :disabled="disabled" @keydown.enter.prevent="save" />
            </ExtensionFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <ExtensionButton type="button" color="neutral" variant="ghost" :label="t('cancel')" @click="close" />
        <ExtensionSaveButton type="button" :label="t('save')" :disabled="disabled" @click="save" />
      </template>
    </ExtensionModal>
  </div>
</template>
