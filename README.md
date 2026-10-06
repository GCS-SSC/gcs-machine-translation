# GCS machine translation

A GCS-SSC extension that translates English/French form pairs using
[`nmt-enfr`](https://github.com/omarmir/nmt-enfr), pinned to commit
`6bb66e0fcb45391e363d4da88a7329241c515c89`.

Enable it under an Agency’s Extensions tab and configure the Agency glossary.
Glossaries use the shared compact table with English/French columns and row
edit/delete actions. Add term and Edit open a medium-sized draft modal; Save
term validates both languages and uniqueness, while Cancel leaves the glossary
unchanged. The table adapter requires SDK 0.3.9.

Enable it on each Stream that should offer translation, optionally adding Stream
terms. Stream terms override Agency terms by the source language term, ignoring
case. The reverse direction applies precedence by the French term. Both terms
are mandatory; duplicate terms in either language are rejected. Glossaries have
at most 500 entries per scope, with 250 characters per term.

A small text button appears below editable, mounted bilingual input/textarea
pairs exposed through SDK 0.3.8’s `bilingual-field.after` capability. The host
supplies the current source, target and a guarded update callback. Translation
changes only the draft. Use the form’s regular Save action after reviewing it.
Existing target text requires confirmation. Changing either field, switching
form records/scopes, disabling a control or closing the modal preserves the
user’s text by rejecting stale results. Shared Proponents let the actor choose
from their separately authorized Agency glossaries.

The modal identifies the result as machine translation and shows a spinner
while loading/translating. The first translation in each direction downloads
public Xenova OPUS-MT model assets from Hugging Face through Transformers.js;
subsequent requests reuse the browser model cache. Source text is processed in
browser workers. The worker, Transformers.js and matching ONNX WebAssembly
runtime are served from this extension’s packaged asset namespace, along with
their license notices at `/extensions/gcs-machine-translation/licenses/`. Failed
translations preserve both fields. Cancel closes the modal and releases the
worker. Each operation uses one worker and disposes it afterward.

No extension tables, secrets or translation-history records are created.
Configuration uses the host’s Agency/Stream JSON storage, ownership and
Contributor permission gates. This extension owns all interface translations
and tests; it consumes no host message lookup.

From the owning extension workspace:

```sh
bun run typecheck
bun run test:unit
bun run test:coverage
bun run test:audit
bun run test:e2e:managed tests/e2e/translation.spec.ts
```

The managed browser launcher is workspace-only and uses the host’s isolated
runner. Standalone browser tests accept `PLAYWRIGHT_BASE_URL` for a compatible
host with demo fixtures and `root@example.com` / `password123` credentials.
They exercise the real library and download language models; network access
is required on a fresh browser profile.
