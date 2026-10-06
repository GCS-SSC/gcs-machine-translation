import { fileURLToPath } from 'node:url'
import { runManagedExtensionE2e } from '../../../scripts/extension-managed-e2e'

await runManagedExtensionE2e({
  acceptedSpec: 'tests/e2e/translation.spec.ts',
  extensionKey: 'gcs-machine-translation',
  extensionRoot: fileURLToPath(new URL('../', import.meta.url)),
  suite: 'extension-machine-translation'
}, process.argv.slice(2))
