# 마법의 소라고둥

Korean, browser-only answer retrieval app. Static Vite build; no backend, API key, server-side inference, or invented answers. It returns an existing choice from the current collection.

## Run

```
npm ci
npm run dev
npm test
npm run build
```

Deploy `dist/` as static files. Parent publishing workflow owns `.openai/hosting.json`.

## Implemented

- Responsive ocean-themed UI, original Blender-rendered conch, reduced-motion support, native accessible dialogs.
- Immediately usable 12-choice Korean demo. Explicit keyword matching; unmatched questions explicitly labeled random selection.
- Local JSON or SQLite import with 20MB / 2,000-record limits, validation, ID uniqueness, precise embedding metadata check.
- SQLite is bundled sql.js WASM, not a backend database. Ordinary SQL table plus JavaScript cosine search; no sqlite-vec dependency.
- Collection persists in this browser's IndexedDB. Questions are not persisted. JSON and SQLite export; basic restoration confirms before replacing data.
- Optional Transformers.js worker with q8 `Xenova/multilingual-e5-small`, pinned model revision, WASM, mean pooling, normalized 384-dimensional vectors, query/passage prefixes.
- Missing document embeddings calculated in the worker on first semantic query; vectors persist with choices. Model errors visibly fall back to keyword retrieval. Download failure can be retried.

## Data contract

See [public/schema-guide.txt](public/schema-guide.txt) for the authoritative JSON and SQLite schema; `public/sample.json` and `public/sample.sqlite` are importable examples. JSON preserves optional tags; the deliberately minimal SQLite schema omits tags. Existing vector metadata must match every field of `CONFIG` in `src/data.js`. Partial embeddings are supported: missing ones are calculated locally when semantic search runs.

An uploaded SQLite file must include `metadata(key,value)` and `records(id,text,answer,embedding)`. This is not an arbitrary SQLite database inspector. Vectors are little-endian Float32 blobs. All import text is rendered with textContent, never HTML. Size/schema restrictions minimize browser load but files should still come from trusted sources.

## Privacy and network

The UI, SQLite WASM and runtime bundles are hosted static files. No question, choice text or database is sent to an inference API. Enabling optional semantic search downloads model/tokenizer assets from Hugging Face (approximately 135 MB plus runtime); those asset requests expose ordinary request metadata such as IP address to the hosting providers. The model runs in a Web Worker using WASM on the device. Browser caching may reduce future downloads; complete offline operation is not promised or tested. No telemetry or external font request is added.

This is a playful retrieval tool, not a medical, financial, legal or emergency decision system. Keyword heuristics and nearest-vector matching can select inappropriate choices; relevance is not certainty.

## Research

[Research and primary sources](docs/research.md) explains Korean model choice, initial download size, SQLite tradeoffs, and the unresolved “laya” name. No claim is made that this multilingual model is the absolute smallest available model; it is a compact Korean-capable retrieval choice, rather than a multi-gigabyte generative model.
