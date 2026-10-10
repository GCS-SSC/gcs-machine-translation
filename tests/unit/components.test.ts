/* eslint-disable jsdoc/require-jsdoc -- Extension-owned test fixtures. */
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { installExtensionTestUiRuntime } from '@gcs-ssc/extensions/testing'
import type { GcsBilingualFieldExtensionContext } from '@gcs-ssc/extensions'
import TranslateField from '../../components/TranslateField.vue'
import GlossaryConfig from '../../components/GlossaryConfig.vue'

const { start, cancel } = vi.hoisted(() => ({ start: vi.fn(), cancel: vi.fn() }))
vi.mock('../../client/translator', () => ({ startTranslation: start }))
const locale = ref('en')
const pair = (values: { source?: string; target?: string; editable?: boolean; apply?: boolean } = {}): GcsBilingualFieldExtensionContext => ({
  kind: 'bilingual-field',
  source: { path: 'name_en', locale: 'en', getText: () => values.source ?? 'Hello', isEditable: () => values.editable !== false },
  target: { path: 'name_fr', locale: 'fr', getText: () => values.target ?? '', isEditable: () => values.editable !== false },
  applyTranslation: vi.fn(() => values.apply !== false)
})
beforeEach(() => {
  locale.value = 'en'
  vi.clearAllMocks()
  const runtime = installExtensionTestUiRuntime({ composables: {
    useI18n: () => ({ locale, n: String, t: () => { throw new Error('Host message lookup forbidden') } })
  } as never })
  runtime.components.UModal = defineComponent({
    name: 'UModal', inheritAttrs: false,
    setup: (_props, { attrs, slots }) => () => attrs.open ? h('section', [h('h2', String(attrs.title)), h('p', String(attrs.description)), slots.body?.(), slots.footer?.()]) : null
  })
  runtime.components.UFormField = defineComponent({
    name: 'UFormField', inheritAttrs: false,
    setup: (_props, { attrs, slots }) => () => h('label', [String(attrs.label), attrs.required ? ' (required)' : '', slots.default?.(), String(attrs.error ?? '')])
  })
  runtime.components.UAlert = defineComponent({
    name: 'UAlert', inheritAttrs: false,
    setup: (_props, { attrs }) => () => h('p', String(attrs.title))
  })
  start.mockReturnValue({ result: Promise.resolve({ text: 'Bonjour' }), cancel })
})
const button = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.findAll('button').find(item => item.text() === label)!

describe('translation UI', () => {
  it('announces machine translation, shows pending and applies the result', async () => {
    let complete!: (value: { text: string }) => void
    start.mockReturnValue({ result: new Promise(resolve => {
      complete = resolve
    }), cancel })
    const context = pair()
    const wrapper = mount(TranslateField, { props: { context, config: { agency: {} } } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toContain('Translating')
    expect(wrapper.text()).toContain('machine translation')
    complete({ text: 'Bonjour' })
    await flushPromises()
    expect(context.applyTranslation).toHaveBeenCalledWith('Bonjour', { source: 'Hello', target: '' })
    expect(wrapper.text()).toContain('check it for accuracy')
    await button(wrapper, 'Close').trigger('click')
    expect(wrapper.text()).not.toContain('check it for accuracy')
    wrapper.unmount()
  })
  it('confirms overwrite before starting and permits cancellation', async () => {
    const wrapper = mount(TranslateField, { props: { context: pair({ target: 'Saisie manuelle' }), config: {} } })
    await wrapper.get('button').trigger('click')
    expect(start).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('already contains text')
    await button(wrapper, 'Translate and replace').trigger('click')
    await flushPromises()
    expect(start).toHaveBeenCalled()
    wrapper.unmount()
  })
  it('cancels an in-flight translation and ignores its eventual result', async () => {
    let complete!: (value: { text: string }) => void
    start.mockReturnValue({ result: new Promise(resolve => {
      complete = resolve
    }), cancel })
    const context = pair()
    const wrapper = mount(TranslateField, { props: { context, config: {} } })
    await wrapper.get('button').trigger('click')
    await button(wrapper, 'Cancel').trigger('click')
    expect(cancel).toHaveBeenCalled()
    complete({ text: 'Bonjour' })
    await flushPromises()
    expect(context.applyTranslation).not.toHaveBeenCalled()
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    start.mockReturnValue({ result: Promise.resolve({ text: 'Salut' }), cancel })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(context.applyTranslation).toHaveBeenCalledWith('Salut', { source: 'Hello', target: '' })
    wrapper.unmount()
  })
  it.each(['failed', 'stale'])('preserves form values on %s', async status => {
    if (status === 'failed') start.mockReturnValue({ result: Promise.reject(new Error('offline')), cancel })
    const wrapper = mount(TranslateField, { props: { context: pair({ apply: false }), config: {} } })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(status === 'failed' ? 'Translation failed' : 'form changed')
    wrapper.unmount()
  })
  it('uses French UI reactively and supports French sources', async () => {
    const context = pair()
    context.source.locale = 'fr'
    context.target.locale = 'en'
    const wrapper = mount(TranslateField, { props: { context, config: {} } })
    locale.value = 'fr-CA'
    await flushPromises()
    expect(wrapper.text()).toContain('Traduire en anglais')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(start).toHaveBeenCalledWith('Hello', 'fr-en', [])
    expect(wrapper.text()).toContain('Vérifiez son exactitude')
    wrapper.unmount()
  })
  it.each([{ source: '' }, { editable: false }])('disables translation for unavailable source %j', values => {
    const wrapper = mount(TranslateField, { props: { context: pair(values), config: {} } })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('chooses an authorized Proponent agency instead of combining agency glossaries', async () => {
    const context = pair()
    context.agencies = [
      { agencyId: '1', nameEn: 'First', nameFr: 'Première', config: { agency: { glossary: [{ english: 'Hello', french: 'Bonjour' }] } } },
      { agencyId: '2', nameEn: 'Second', nameFr: 'Deuxième', config: { agency: {} } }
    ]
    const wrapper = mount(TranslateField, { props: { context, config: {} } })
    await wrapper.get('button').trigger('click')
    expect(start).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Choose an agency glossary')
    // SDK test selector emits the same public model update as the real select.
    wrapper.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', '1')
    await flushPromises()
    await wrapper.findAll('button').filter(item => item.text() === 'Translate to French').at(-1)!.trigger('click')
    await flushPromises()
    expect(start).toHaveBeenCalledWith('Hello', 'en-fr', [{ english: 'Hello', french: 'Bonjour', enabled: true }])
    wrapper.unmount()
  })
  it('uses the only authorized agency automatically', async () => {
    const context = pair()
    context.agencies = [{ agencyId: '1', nameEn: 'First', nameFr: 'Première', config: { agency: {} } }]
    const wrapper = mount(TranslateField, { props: { context, config: {} } })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(start).toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('glossary table and draft editor', () => {
  it('lists terms in a table and adds only validated modal drafts', async () => {
    const wrapper = mount(GlossaryConfig, { props: { modelValue: {} } })
    expect(wrapper.text()).toContain('Agency terms')
    expect(wrapper.get('table').text()).toContain('English term')
    expect(wrapper.findAll('input')).toHaveLength(0)
    await button(wrapper, 'Add term').trigger('click')
    await button(wrapper, 'Save term').trigger('click')
    expect(wrapper.text()).toContain('Enter both languages')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.findAllComponents({ name: 'UInput' }).map(input => input.vm.$attrs.lang)).toEqual(['en', 'fr'])
    await wrapper.findAll('input')[0]!.setValue(' grant ')
    await wrapper.findAll('input')[1]!.setValue(' subvention ')
    await button(wrapper, 'Save term').trigger('click')
    expect(wrapper.findAll('input')).toHaveLength(0)
    expect(wrapper.get('table').text()).toContain('subvention')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toEqual({ version: 1, glossary: [{ english: 'grant', french: 'subvention' }] })
    wrapper.unmount()
  })
  it('edits a copied row, cancels without mutations, and removes by stable key', async () => {
    const original = { glossary: [{ english: 'grant', french: 'subvention' }] }
    const wrapper = mount(GlossaryConfig, { props: { modelValue: original, streamId: '2' } })
    expect(wrapper.text()).toContain('Stream terms')
    await wrapper.get('button[aria-label="Edit term grant"]').trigger('click')
    await wrapper.findAll('input')[1]!.setValue('allocation')
    await button(wrapper, 'Cancel').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(original.glossary[0]!.french).toBe('subvention')
    await wrapper.get('button[aria-label="Edit term grant"]').trigger('click')
    await wrapper.findAll('input')[1]!.setValue('allocation')
    await button(wrapper, 'Save term').trigger('click')
    expect(wrapper.get('table').text()).toContain('allocation')
    await wrapper.get('button[aria-label="Remove term 1"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toEqual({ version: 1, glossary: [] })
    wrapper.unmount()
  })
  it('rejects duplicate terms and prevents stale drafts after external replacement', async () => {
    const wrapper = mount(GlossaryConfig, { props: { modelValue: { glossary: [{ english: 'grant', french: 'subvention' }] } } })
    await button(wrapper, 'Add term').trigger('click')
    await wrapper.findAll('input')[0]!.setValue('GRANT')
    await wrapper.findAll('input')[1]!.setValue('allocation')
    await button(wrapper, 'Save term').trigger('click')
    expect(wrapper.text()).toContain('Terms must be unique')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.setProps({ modelValue: { glossary: [{ english: 'new', french: 'nouveau' }] } })
    expect(wrapper.findAll('input')).toHaveLength(0)
    expect(wrapper.get('table').text()).toContain('nouveau')
    wrapper.unmount()
  })
  it('clears a new draft on an external replacement matching an earlier saved value', async () => {
    const wrapper = mount(GlossaryConfig, { props: { modelValue: {} } })
    await button(wrapper, 'Add term').trigger('click')
    await wrapper.findAll('input')[0]!.setValue('grant')
    await wrapper.findAll('input')[1]!.setValue('subvention')
    await button(wrapper, 'Save term').trigger('click')
    const saved = wrapper.emitted('update:modelValue')!.at(-1)![0]
    await button(wrapper, 'Add term').trigger('click')
    await wrapper.setProps({ modelValue: structuredClone(saved) as never })
    expect(wrapper.findAll('input')).toHaveLength(0)
    wrapper.unmount()
  })
  it('localizes columns and the editor reactively and respects disabled state', async () => {
    const wrapper = mount(GlossaryConfig, { props: { modelValue: {}, disabled: true } })
    expect(button(wrapper, 'Add term').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ disabled: false })
    await button(wrapper, 'Add term').trigger('click')
    locale.value = 'fr'
    await flushPromises()
    expect(wrapper.get('table').text()).toContain('Terme anglais')
    expect(wrapper.text()).toContain('Enregistrer le terme')
    await wrapper.setProps({ disabled: true })
    expect(wrapper.findAll('input')).toHaveLength(0)
    wrapper.unmount()
  })
  it('allows editing at the term limit while preventing another addition', async () => {
    const glossary = Array.from({ length: 500 }, (_, index) => ({ english: `term ${index}`, french: `terme ${index}` }))
    const wrapper = mount(GlossaryConfig, { props: { modelValue: { glossary } } })
    expect(button(wrapper, 'Add term').attributes('disabled')).toBeDefined()
    await wrapper.get('button[aria-label="Edit term term 0"]').trigger('click')
    await button(wrapper, 'Save term').trigger('click')
    expect((wrapper.emitted('update:modelValue')!.at(-1)![0] as { glossary: unknown[] }).glossary).toHaveLength(500)
    wrapper.unmount()
  })
  it('keeps invalid externally supplied configuration visible', () => {
    const wrapper = mount(GlossaryConfig, { props: { modelValue: { glossary: [{ english: '', french: 'bonjour' }] } } })
    expect(wrapper.text()).toContain('Enter both languages')
    wrapper.unmount()
  })
})
