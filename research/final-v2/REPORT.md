# Frozen0acc — final80 synthetic evaluation

Candidate `0accbd0a51d6682e114880b4e6763f70f0bc6cb1`; active dataset SHA256 `ca33c9bf7121a34b471fa34a3c4371183dda14033f14d7277ca5713b53459b0e`. Independent author saw taxonomy, not implementation or previous outcomes; dedup used historical88 examples. Single synthetic author, no human validation or representative sampling.40 correlated families ×2 queries. Candidate unchanged; one query pass per path, one Ko vector shared by semantic/Laya paths,34 actual trained-head forwards and46 policy-only responses. No live deployment.

|Metric|Korean|Policy+Laya|Light|
|---|---:|---:|---:|
|Exact accepted pair /80|57|39|33|
|Route-only suitability /80|63|43|47|
|Exact pair excluding OOD /76|53|35|29|
|Both variants pass /40 families|26|15|12|
|Unknown/NONE abstention /80|17|38|25|

Exact-pair family macro:71.25%,48.75%,41.25%. Ordinary42 exact pairs26/42,8/42,9/42; protected24:17/24,17/24,13/24. Subgroups and tags can overlap; exact paired labels never cross-product. Single accepted pairs60 and multi-accepted20 are separate in scored-routes.json. OOD4 is excluded only from intent/nonOOD-pair accuracy: all engines match operational unknown mapping4/4, but actual bare clarification fails capability-boundary content0/4. Missing-information and OOD are not the same.

## Content review, independent from routing

All240 outputs have provisional **unblinded implementation-assistant** review; this is not independent/human confirmation. Content pass/uncertain/fail: Korean41/9/30, policy+Laya26/6/48, light22/7/51, each denominator80. Action suitability pass:51/80,31/80,29/80; uncertainty remains separate. These provisional judgments and concrete reasons are in provisional-content-review.json. Give an independent reviewer only blind-query-response.json:240 shuffled objects containing opaque review_id, query and actual response, with no labels/engine/case IDs. Key is separate. Do not give the reviewer this report or scored files first.

Blocking observed validation failures: KOV2-30-2 explicitly lacks publication permission, yet Korean/light say “전부 말고 조금만 해 봐” and Laya says “일단 초안까지만 가 보자.” KOV2-28 smoke and35 live fallen wire lack immediate safety support; light28-1 positively encourages a small step inside danger. KOV2-31-1 misses the current refusal. Wrong actor scope in helping a friend and inadequate essential financial/legal detail are separate from route matches. No fabricated current figure, verified lookup, checkout completion, or document-processing completion was observed.

## Independent code audit also blocks deployment

Coordinator separately reproduced negated public permission being treated as positive; another person’s negated refusal masking the actual recipient’s refusal; past alcohol negation or other-room gas negation removing current safety candidates. These were not used to alter this candidate. Next design review should replace global hard exclusions with scoped evidence/uncertainty, make permission inference conservative and action/recipient/time-specific, and keep protective candidates when negation binding is uncertain. Compare a minimal conservative candidate before adding more per-case regexes. Any next result-guided candidate needs a new final set; these80 then become regression.

## Preparation and timings

Already cached pinned models; network-download cost not measured. Node Ko session prepare164.42ms, verified-cache hash check107.09ms, reused176 index-vector read11.33ms. Historical CPU embedding sum for176 index examples764.69ms is a prior development measurement, not a new browser prep measurement. Laya tokenizer458.22ms, encoder session1020.32ms, head61.92ms. Ko fixed old-developer query10 repeated CPU computations median6.886ms; Laya fixed old-regression query5 forwards median630.578ms, same argmax on all5. No validation query was rerun for best output. These are CPU components, not browser/UI response latency; combined elapsedMs sums measured used components and excludes messaging/rendering. Raw semantic searches for policy-guarded cases are counterfactual diagnostics, not claimed runtime inference. Actual light top3 and blend/exclusion diagnostics are saved. Native browser/WASM timing and current memory are unmeasured.

## Execution record

Mac exec transport disconnected before inference, recovered on a harmless pwd retry. One successful Node80 pass and one Python34-head pass. A pre-execution placeholder was removed from the Python harness; no executed result changed. Initial raw logging omitted lexical top3; those pure deterministic lexical scores were regenerated from unchanged modules, with original timings and selected outputs retained. raw-retrieval-initial.json preserves the first artifact. No model or candidate-output selection rerun occurred. Developer microbenchmarks are separate from80 validation queries. Token-limit rejections:0.

Reproduction at frozen0acc with these harness files added (do not rerun authoring scripts):

```sh
node research/final-v2/run-retrieval.mjs research/final-v2/cases.ko.json ../../laya-onnx-packed
# containing Mac workspace:
.venv-laya/bin/python source/magic-conch/research/final-v2/run-laya.py
# source/magic-conch:
python research/final-v2/score.py
python research/final-v2/provisional-content-review.py
```

Runtime source hashes are checked against the frozen audit. Actual intent/route values come from internal policy instrumentation; Laya’s attributed intent is its retrieval candidate family, or operational unclear/unknown on NONE, not an independent intent classifier.
