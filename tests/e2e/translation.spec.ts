import { test, expect } from '@playwright/test'

// This browser suite loads the real nmt-enfr worker, Transformers.js and public language models.
test('translates both directions with scoped glossaries through the real bilingual form', async ({ page }) => {
  test.setTimeout(360000)
  page.on('console', message => { if (message.type() === 'error') console.error('Browser:', message.text()) })
  page.on('requestfailed', request => console.error('Request failed:', request.url(), request.failure()?.errorText))
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        this.addEventListener('message', event => {
          if (event.data?.status === 'error') console.error('Translation worker:', event.data.error)
        })
      }
    }
  })
  await page.goto('/en/login')
  await page.getByLabel('Email').fill('root@example.com')
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: /^(login|connexion)$/i }).click()
  await page.waitForURL(url => !url.pathname.endsWith('/login'))
  const streamsResponse = await page.request.get('/api/agreements/lookups/streams?limit=25&permission_action=create')
  expect(streamsResponse.ok()).toBe(true)
  const stream = (await streamsResponse.json()).items[0] as { id: string; agency_id: string; program_id: string }
  expect(stream).toBeTruthy()
  const extensionKey = 'gcs-machine-translation'
  const agencyPath = `/api/extensions/agency/${stream.agency_id}`
  const streamPath = `/api/extensions/streams/${stream.id}`
  const invalid = await page.request.patch(agencyPath, { data: { extensionKey, enabled: true, config: { glossary: [{ english: 'grant', french: '' }] } } })
  expect(invalid.status()).toBe(400)
  const enabled = await page.request.patch(agencyPath, { data: { extensionKey, enabled: true, config: { glossary: [{ english: 'funding agreement', french: 'accord de financement' }] } } })
  expect(enabled.status(), await enabled.text()).toBe(200)
  const configured = await page.request.patch(streamPath, { data: { extensionKey, enabled: true, config: { glossary: [{ english: 'funding agreement', french: 'entente de financement' }] } } })
  expect(configured.status(), await configured.text()).toBe(200)
  const runtime = await page.request.get(`/api/extensions/runtime?slot=bilingual-field.after&subject=transfer_payment&streamId=${stream.id}&permissionAction=update`)
  expect(runtime.status(), await runtime.text()).toBe(200)
  expect((await runtime.json()).items.find((item: { extensionKey: string }) => item.extensionKey === extensionKey).config).toEqual({
    agency: { glossary: [{ english: 'funding agreement', french: 'accord de financement' }] },
    stream: { glossary: [{ english: 'funding agreement', french: 'entente de financement' }] }
  })
  await page.goto(`/en/agencies/${stream.agency_id}`)
  await page.getByRole('tab', { name: 'Extensions', exact: true }).or(page.getByRole('link', { name: 'Extensions', exact: true })).click()
  await page.getByRole('row').filter({ hasText: 'Machine translation' }).getByRole('button', { name: 'Configure: Machine translation', exact: true }).click()
  const glossary = page.getByRole('dialog', { name: 'Machine translation', exact: true })
  await expect(glossary.getByRole('table')).toContainText('accord de financement')
  await expect(glossary.getByRole('textbox')).toHaveCount(0)
  await glossary.getByRole('button', { name: 'Add term', exact: true }).click()
  const termEditor = page.getByRole('dialog', { name: 'Add term', exact: true })
  const agencyEnglish = termEditor.getByRole('textbox', { name: /English term/ })
  const agencyFrench = termEditor.getByRole('textbox', { name: /French term/ })
  await expect(agencyEnglish).toHaveAttribute('aria-required', 'true')
  await expect(agencyEnglish).toHaveAttribute('required', '')
  await expect(agencyFrench).toHaveAttribute('aria-required', 'true')
  await termEditor.getByRole('button', { name: 'Save term', exact: true }).click()
  await expect(termEditor).toContainText('Enter both languages')
  await expect(agencyEnglish).toHaveAttribute('aria-describedby', /error/)
  await agencyEnglish.fill('community')
  await agencyFrench.fill('collectivité')
  await termEditor.getByRole('button', { name: 'Save term', exact: true }).click()
  await expect(termEditor).not.toBeVisible()
  await expect(glossary.getByRole('table')).toContainText('collectivité')
  await glossary.getByRole('button', { name: 'Edit term community', exact: true }).click()
  const editing = page.getByRole('dialog', { name: 'Edit term', exact: true })
  await editing.getByRole('textbox', { name: /French term/ }).fill('communauté')
  await editing.getByRole('button', { name: 'Save term', exact: true }).click()
  await expect(glossary.getByRole('table')).toContainText('communauté')
  await glossary.getByRole('button', { name: 'Remove term 2', exact: true }).click()
  await glossary.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(glossary).not.toBeVisible()
  await page.goto(`/en/transfer-payments/${stream.program_id}/streams/${stream.id}`)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit', exact: true, includeHidden: true })
  const english = editor.locator('input[name="egcs_tp_name_en"]')
  const french = editor.locator('input[name="egcs_tp_name_fr"]')
  await english.fill('The funding agreement supports communities.')
  await french.fill('Texte saisi manuellement')
  // The action belongs to the same UFormField as its source.
  await editor.getByRole('button', { name: 'Translate to French', exact: true }).first().click()
  const translation = page.getByRole('dialog', { name: 'Machine translation', exact: true })
  await expect(translation).toContainText('Check that it is accurate')
  await expect(french).toHaveValue('Texte saisi manuellement')
  await translation.getByRole('button', { name: 'Translate and replace', exact: true }).click()
  await expect(translation.getByRole('status')).toContainText('Translating')
  await expect.poll(async () => translation.textContent(), { timeout: 240000 }).toMatch(/Translation copied|Translation failed|form changed/)
  await expect(translation).toContainText('Translation copied')
  await expect(french).toHaveValue(/entente de financement/i)
  await expect(english).toHaveValue('The funding agreement supports communities.')
  await translation.getByRole('button', { name: 'Close', exact: true }).last().click()
  await english.fill('')
  await editor.getByRole('button', { name: 'Translate to English', exact: true }).first().click()
  await expect.poll(async () => translation.textContent(), { timeout: 240000 }).toMatch(/Translation copied|Translation failed|form changed/)
  await expect(translation).toContainText('Translation copied')
  await expect(english).toHaveValue(/funding agreement/i)
  await translation.getByRole('button', { name: 'Close', exact: true }).last().click()
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.goto(`/fr/paiements-de-transfert/${stream.program_id}/volets/${stream.id}`)
  // Navigate by the localized route emitted by Nuxt if the English path redirects.
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Traduire en français', exact: true }).first()).toBeVisible()
})
