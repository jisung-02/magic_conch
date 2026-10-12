# Pipeline v2 — development candidate, deployment held

All results here are development/regression. The old candidate-blind68 set is now explicitly regression. Its original b622 candidate and d117 raw results remain intact. A new independent final set has not been received or inspected.

## Independent component comparisons

A uses frozen88 examples/global .06 conflict/old replies. H changes only hierarchical parent-route backoff; E changes only examples to176. B adds scoped context to88 and keeps old replies. C combines scoped context,176 examples, route-type floors, lexical/dense utility and suitable short stored replies. Additional C component removals are preserved in ablation-results.json. This is not a new transformer.

The first run gave A44/68, H53/68, E58/68. H reduced abstention but increased false protection on everyday questions; E did not solve all critical misses. Development iterations addressed Korean inflections, omitted particles, active intent after a prior denial, actual recipient permission and request/background scope. No evaluation IDs, exact queries or fixed person names occur in runtime rules. Exact normalized index/dev query matches are0, which does not exclude semantic overlap or overfitting. Intermediate phase results are preserved.

Final automatic route results: C68/68 regression,88/88 developer stress and8/8 additional edge stress. Selected paired intent/route is63/64 on regression (OOD4 excluded),82/82 stress (OOD6 excluded),8/8 edges. The remaining regression intent mismatch is craft_trial task_start vs supplied start_hobby; the short small-step answer is reviewed separately. Raw expanded embedding intent top1 is54/64,71/82 and3/8: context/routing gains must not be described as embedding-only accuracy. Per-family macro equals these surface rates because every family has2 variants. All labels retained.

## Frozen policy specification

- Ko-SRoBERTa q8, revision ba6ffa9571bf149f8131138929500bff0b7e088d; no prefix; mean pooling + normalize;128-token truncation;768 dimensions. Same verified model files, no extra model download.
-22 intents, base88 + developer88 =176 natural index examples. Both semantic and expanded char-bigram retrieval use the expanded examples in C.
- Within-intent utility .75 maximum example cosine + .25 centroid cosine. Unresolved-query utility .85 semantic + .15 lexical. These are utilities, never calibrated probabilities.
- Explicit co-evidence and limited clause/subject/negation/quotation/recipient scope can select an intent. Domain words alone are not sufficient for guarded medical/legal/financial request override: clearly separate everyday request clauses and commitment/financial action cues are checked.
- Parent-route selection inspects all22 scores and uses taxonomy.routingPrecedence. Semantic protected floor .58, ordinary floor .38, protective-parent gap .025. Model-free path floors .42/.15. This is route-type development selection, not statistical calibration/guarantees. The grid of27 configurations is stored;66 development/22 calibration-dev variants share no scenario family. Both partitions are authored dev.
- A protective/uncertain/factual/scope route is locked. Its guidance is retained even if Laya returns NONE, crashes or times out; in fact Laya is skipped there. Only everyday answer candidates are evaluated by the actual trained head. UI distinguishes context-only guidance, Korean-search guidance and actual Laya inference.
- Default model-free path remains available without automatic model download. Full semantic C is recommended when the user explicitly enables Korean search. Existing imports are not overwritten. The legacy E5 contract remains384 dimensions for user files.
- Default DB123 records: original100 short answers +8 additional ordinary replies +15 guides. The100 originals are data, not100 reachable reply classes; only mapped subsets are currently selected. Short replies and guides remain stored DB text, not generated predictions.

## Actual Laya and response quality

Actual trained-head CPU measurements and policy-only outcomes are separated in laya-results.json. The initial run executed70 unlocked inputs, while94/164 were policy-locked. Later reuse requires exact typed-batch and candidate equality with the original inputs; changed inputs are executed again and inferenceReuse records counts. A policy+Laya route score is not standalone Laya accuracy. Keep Laya experimental and recommend semantic C.

Response-route acceptance is not semantic/action quality. The model identities are removed in blind-review.json (A/C/policy+Laya,204 outputs). Give a new reviewer only that file; withhold key, raw scores and this report. No blinded Korean-speaking human review is claimed. Own development content inspection verifies that the old photo-refusal encouragement and missing gas/flood/self-harm support are replaced with contextual guides, that everyday replies use relevant intent-specific text, and that unsupported tasks state their scope. This is an unblinded implementation review, not an independent quality score.

## Safety and generalization limits

The context component is a transparent, limited pattern system, not a general Korean parser. Complex multi-party clauses, incomplete quotation, implied subjects and unfamiliar morphology can still be mishandled. Development perfect route fit cannot exclude overfitting. Newly added stress cases, aliases, rules and response revisions are all dev. No population accuracy, safety guarantee or highest-quality claim. The next candidate-blind80 questions must be run only after commit freeze; any result-driven tuning then requires a new final set.

No live deployment, main merge or Release overwrite. No new token/persistent permission. Existing trained artifact is reused. Native browser verification of this candidate is pending because the browser interaction tool is unavailable; Node CPU/VM tests and Vite build do not substitute for it.

## Reproduction

From source/magic-conch with the verified existing model-cache and verified-pin symlinks:

```sh
node research/pipeline-v2/prepare-vectors.mjs
node research/pipeline-v2/compare.mjs
node research/pipeline-v2/calibrate.mjs
node research/pipeline-v2/prepare-laya.mjs ../../laya-onnx-packed
# from the containing Mac workspace:
.venv-laya/bin/python source/magic-conch/research/pipeline-v2/evaluate-laya.py
# back in source/magic-conch:
node research/pipeline-v2/review.mjs
npm test
npm run build
```

source-audit.json records runtime-source hashes and overlap checks. Existing d117 final-result files were not replaced. Hierarchical backoff is an app-specific hypothesis inspired by [Hierarchical Selective Classification](https://proceedings.neurips.cc/paper_files/paper/2024/hash/c8b100b376a7b338c84801b699935098-Abstract-Conference.html), not a reproduction of its ImageNet experiments or guarantees. The suggested small supervised dense/char probe has not been implemented: current small pipeline changes first reached dev saturation, so a fresh final evaluation is more informative than adding a new model now.

## Final recorded automatic summaries

| Profile | Regression route /68 | Dev route /88 | Edge route /8 |
|---|---:|---:|---:|
|A_frozen88_global|44|55|2|
|H_hierarchy88_only|53|65|4|
|E_expansion_only_global|58|69|2|
|C_full176|68|88|8|
|Policy + actual Laya|55|73|6|
|Model-free light path|53|80|8|

Laya policy locks:38/68,50/88,6/8. Actual head calls:30,38,2; NONE:14,15,2. These are combined policy/model results; the policy-only94 rows are not head inference. {"unchangedTypedInputs":67,"freshlyExecuted":3,"source":"laya-results.phase1.json; exact batch and candidate equality; same model files"}
