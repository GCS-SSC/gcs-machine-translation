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

describe('glossary editor', () => {
  it('adds bilingual required terms, edits, removes and switches locale', async () => {
    const wrapper = mount(GlossaryConfig, { props: { modelValue: {} } })
    expect(wrapper.text()).toContain('Agency terms')
    await button(wrapper, 'Add term').trigger('click')
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('grant')
    await inputs[1]!.setValue('subvention')
    const value = wrapper.emitted('update:modelValue')!.at(-1)![0]
    expect(value).toEqual({ version: 1, glossary: [{ english: 'grant', french: 'subvention' }] })
    await wrapper.setProps({ modelValue: value as never, streamId: '2' })
    expect(wrapper.text()).toContain('Stream terms')
    locale.value = 'fr'
    await flushPromises()
    expect(wrapper.text()).toContain('Terme anglais')
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toEqual({ version: 1, glossary: [] })
    wrapper.unmount()
  })
  it('hydrates terms, shows validation errors and follows external configuration replacement', async () => {
    const wrapper = mount(GlossaryConfig, { props: { modelValue: { glossary: [{ english: 'hello', french: 'bonjour' }] } } })
    expect(wrapper.findAll('input')).toHaveLength(2)
    await wrapper.setProps({ modelValue: { glossary: [{ english: '', french: 'bonjour' }] } })
    expect(wrapper.text()).toContain('Enter both languages')
    await wrapper.setProps({ modelValue: {} })
    expect(wrapper.findAll('input')).toHaveLength(0)
    wrapper.unmount()
  })
})
