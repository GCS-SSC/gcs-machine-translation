<script setup lang="ts">
/* eslint-disable jsdoc/require-jsdoc -- Local UI actions use the public SDK contracts. */
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { nanoid } from 'nanoid'
import type { GcsExtensionJsonConfig } from '@gcs-ssc/extensions'
import { ExtensionAlert, ExtensionButton, ExtensionFormField, ExtensionInput, useExtensionI18n } from '@gcs-ssc/extensions/ui'
import { GlossaryConfigSchema } from '../shared/config'
import { messages } from '../i18n/messages'

const model = defineModel<GcsExtensionJsonConfig>({ default: () => ({}) })
const { streamId, disabled = false } = defineProps<{ streamId?: string; disabled?: boolean }>()
const { t } = useExtensionI18n(messages)
type Row = { key: string; english: string; french: string }
const rows: Ref<Row[]> = ref([])
let lastEmitted = ''
watch(model, value => {
  if (JSON.stringify(value) === lastEmitted) return
  const result = GlossaryConfigSchema.safeParse(value)
  rows.value = result.success ? result.data.glossary.map(entry => ({ ...entry, key: nanoid() })) : []
}, { immediate: true, deep: true })
const validation = computed(() => GlossaryConfigSchema.safeParse(model.value))
const fieldError = (index: number, language: 'english' | 'french') => validation.value.success
  ? undefined
  : validation.value.error.issues.some(issue => issue.path.join('.') === `glossary.${index}.${language}`) ? t('invalid') : undefined
const publish = () => {
  const value = { version: 1, glossary: rows.value.map(({ english, french }) => ({ english, french })) }
  lastEmitted = JSON.stringify(value)
  model.value = value
}
const add = () => {
  rows.value.push({ key: nanoid(), english: '', french: '' })
  publish()
}
const remove = (index: number) => {
  rows.value.splice(index, 1)
  publish()
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted">
      {{ t(streamId ? 'streamHelp' : 'agencyHelp') }}
    </p>
    <ExtensionAlert v-if="!validation.success" color="error" :title="t('invalid')" />
    <p v-if="rows.length === 0" class="text-sm text-muted">
      {{ t('empty') }}
    </p>
    <div v-for="(row, index) in rows" :key="row.key" class="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <ExtensionFormField :name="`glossary.${index}.english`" :label="t('english')" :error="fieldError(index, 'english')" required>
        <ExtensionInput v-model="row.english" :maxlength="250" :disabled="disabled" @update:model-value="publish" />
      </ExtensionFormField>
      <ExtensionFormField :name="`glossary.${index}.french`" :label="t('french')" :error="fieldError(index, 'french')" required>
        <ExtensionInput v-model="row.french" :maxlength="250" :disabled="disabled" @update:model-value="publish" />
      </ExtensionFormField>
      <ExtensionButton color="neutral" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('remove', { number: index + 1 })" :disabled="disabled" @click="remove(index)" />
    </div>
    <ExtensionButton color="neutral" variant="soft" :label="t('add')" :disabled="disabled || rows.length >= 500" @click="add" />
  </div>
</template>
