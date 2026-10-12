# Korean Magic Conch: retrieval methods and honest optimization plan

Research date: 2026-10-10. Recommendations below are proposed experiments, not measured improvements. No app changes or browser runtime tests were performed for this report.

## Recommendation in one paragraph

First repair the representation: retrieve natural Korean **question examples**, aggregate examples into **intent/action families**, then choose a compatible answer from that family. Compare this against the existing keyword-passage baseline using the same embedding model before attributing changes to a new model. Add a cheap lexical branch only if it improves complementary recall. Feed a small deduplicated shortlist to the **actual multilingual Laya decision model**, retaining its contribution only where evaluation supports it; if Laya is a required feature, label its mode and its limitations rather than replacing it silently with cosine similarity. Separate semantic interpretation from the app's playful choice of fortune. Neither an embedding nor Laya can establish whether someone objectively should change jobs from a one-sentence question.

## 1. Content representation matters before model size

Store each answer with stable IDs and explicit metadata: answer family, applicable intents, action direction, temporal stance, compatible question forms, and contraindications. Avoid training the semantic layer to equate “career topic” with a specific recommendation. A question about quitting and one about interviewing elsewhere share vocabulary but may need different answer compatibility.

For each intent, author 4–8 short natural question examples spanning formal/informal Korean, everyday synonyms, and realistic wording. Example family: “이직할까?”, “직장을 옮기는 게 좋을까?”, “다른 회사에 지원해 볼까요?” Keep “퇴사하고 쉬고 싶어” separate where its practical meaning differs. Give families comparable example counts. Review generated examples for meaning drift. Do not insert test queries into the index.

**Multi-example scoring:** encode examples separately; compute all query–example similarities; group by intent/answer ID; compare maximum similarity against mean of the best two examples. Maximum preserves niche phrasing but gives large example collections more chances to win. A centroid is cheap but can dilute distinct meanings. Do not concatenate unrelated examples into a single long embedding. This is multiple sentence vectors per family, not ColBERT token-level late interaction.

Question expansion is a practical adaptation of query-prediction document expansion. The original work learns plausible queries to improve retrieval; manually curated examples avoid adding a generation model at runtime. Its reported gains do not certify this Korean app. [Original doc2query paper](https://arxiv.org/abs/1904.08375)

**Symmetric versus asymmetric:** question-to-question retrieval is symmetric; question-to-explanatory-passage retrieval is asymmetric. Benchmark both representations correctly instead of accidentally mixing their prompts. [Sentence Transformers semantic search guidance](https://www.sbert.net/examples/sentence_transformer/applications/semantic-search/README.html)

For E5, use `query: ` on both user questions and indexed question examples; use `query: ` / `passage: ` for asymmetric retrieval. Preserve attention-mask-aware mean pooling and L2 normalization. E5's compressed high cosine range is expected; 0.8 does not mean 80% correct, and a threshold borrowed from another model is invalid. [E5 model card](https://huggingface.co/intfloat/multilingual-e5-small)

## 2. Cheap browser-local lexical complement

Normalize Unicode to NFC, trim, and collapse whitespace. Preserve negation, numbers, named entities, and meaningful punctuation. Make a second space-insensitive field for lexical matching rather than deleting spaces from the model input. Avoid aggressive Korean suffix stripping with ad hoc regexes.

Implement character 2- and 3-gram overlap/BM25 in plain JavaScript over the curated examples and short intent descriptions. Add curated synonyms such as 이직↔직장 옮기기 as corpus metadata, without forcibly rewriting every input. Character grams can tolerate spacing and inflection differences but cannot discover a synonym with no shared characters. One-character grams tend to produce incidental matches; test them separately only for very short input. N-gram analysis is established, but the specific Korean settings here are a hypothesis to validate. [Official n-gram tokenizer documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/analysis-ngram-tokenizer.html)

Korean morphology-aware BM25 is a useful later comparison, not a prerequisite. Elasticsearch Nori uses a Korean dictionary and configurable compound decomposition; deploying Elasticsearch is not browser-only. A bundled JS/WASM morphological analyzer would need independent size, licensing, tokenization, and compatibility checks. [Nori tokenizer documentation](https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-nori-tokenizer)

Deduplicate to intent IDs before fusion. Compare dense-only against a union of dense top-8 and lexical top-8, fused by RRF: sum over branches of `weight / (k + rank)`. Exclude missing/zero-overlap lexical candidates instead of granting arbitrary tied ranks. RRF avoids pretending raw BM25 and cosine scales are comparable. Try only a small prespecified grid, e.g. k ∈ {10, 60}, lexical weight ∈ {0.25, 0.5, 1}; keep the simplest non-inferior variant. RRF is supported by original IR experiments, but improvement here is not guaranteed. [Original RRF paper](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf)

For roughly 100 answers and several hundred examples, exhaustive float-vector dot products are simple enough that an ANN/vector database is unnecessary. Precomputed vectors must match the exact model revision, tokenizer, prefixes, pooling, and quantization configuration used at inference. Regenerate/version them when any of those change.

## 3. Shortlist → actual Laya decisions

Use a 4–8 **distinct intent/action shortlist**, with concise Korean descriptions and a “none fits / unclear” option. Ask which interpretation the question expresses, not whether the user's real-world decision will succeed. For a second answer-selection stage, give short applicable-answer descriptions, not a 100-answer wall of prose. Prefer testing a single typed choice first over many ordinal relevance scores.

Laya's own model card warns of weak zero-shot results in its typed-decision evaluation, option-budget degradation for large choice sets, overconfidence, and an unusable act-probability gate. Use the multilingual checkpoint for Korean, audit truncated tokens, and calibrate on local labels. Neutral option IDs with descriptive text are worth an ablation; test shuffled order and renamed IDs to reveal position/label dependence. Do not equate the card's “calibrated” headline with demonstrated Korean-app reliability. [Laya model card and limitations](https://huggingface.co/convaiinnovations/laya/raw/main/README.md)

General retrieve–rerank pipelines support a cheap first stage and a joint query/candidate scorer afterward. They do not establish that any arbitrary decision model is a good reranker. Measure Laya's selection accuracy conditional on the right intent being present, and its ability to reject a shortlist with no correct candidate. [Retrieve and rerank documentation](https://sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html)

Browser-only means executing real weights locally. The documented Python ONNX path is not proof of ONNX Runtime Web compatibility. Verify tokenizer serialization, custom decision head, all input/output tensors, operations, WASM/WebGPU execution, and parity against reference outputs. Transformers.js runs supported ONNX models locally; unsupported custom architectures require explicit implementation/export work. A Python/localhost server or hosted endpoint violates a strict browser-only runtime constraint. [Transformers.js documentation](https://huggingface.co/docs/transformers.js/en/index)

If shortlist recall is poor, improve retrieval first; Laya cannot select a missing intent. If recall is high but Laya selection degrades results, report that and investigate domain training rather than masking it with undocumented rules.

## 4. Compatibility, uncertainty, and consistency

**Negation and intent:** test minimal pairs including “연락할까?” / “연락하지 말까?”, “사고 싶어” / “사고 싶지 않아”, and “퇴사할까?” / “퇴사하지 않고 버틸까?”. Negation is scoped, so merely finding 안/못/않 is not a reliable polarity parser. Use reviewed compatibility metadata for explicit high-confidence cases and route ambiguity to a neutral answer. Do not turn “안” detection into a universal reversal. Research demonstrates that ordinary neural retrieval can fail negation discrimination; the Korean behavior still needs its own tests. [NevIR paper](https://aclanthology.org/2024.eacl-long.139/)

**Abstention:** gate using development-tuned top score and top-1/top-2 **intent-level** margin. Two examples of the same intent are not competing alternatives. Include unrelated questions, empty/gibberish input, mixed intents, and missing-candidate cases. When confidence is low, ask a short clarifying question or choose a clearly noncommittal reply. Do not show cosine/RRF as a probability.

If probability displays matter, fit a small logistic correctness calibrator on score, margin, and branch agreement, using a separate calibration split; for Laya logits, test temperature scaling. Evaluate Brier score/reliability and risk versus coverage. Calibration cannot repair wrong rankings and may fail under distribution shift. Small samples warrant score ranges or no numeric confidence, rather than precision theater. [Temperature scaling research](https://proceedings.mlr.press/v70/guo17a.html)

**Consistency:** normalized exact-input caching is safe and testable. Semantic caching risks returning an answer to a negated or materially changed question. If used, require the same confidently resolved intent/action and compatibility constraints; otherwise compute anew. Cache keys include model, corpus, configuration, and answer-policy versions. If paraphrases should give identical prose, choose the answer deterministically by resolved intent plus a stable user/session seed, not a hash of raw wording. Keep cache-hit consistency separate from uncached model consistency in reports.

**Diversity/MMR:** low priority for a one-answer app. First deduplicate paraphrases into intent families. MMR can diversify a candidate set by trading relevance for novelty, but can remove the best interpretation. Use only if near-duplicate candidates demonstrably crowd out relevant alternatives; never use it to force a different answer on repeated paraphrases. [Carbonell's MMR teaching notes](https://www.cs.cmu.edu/afs/cs.cmu.edu/academic/class/15381-s01/public/www/lec/ir/jgc-ir-handout.pdf)

## 5. Bounded experiment ladder

Freeze corpus, model revisions, preprocessing, seed, runtime/backend, and evaluation files for every run. Save per-query ranked intent IDs, scores, selected answer, abstention, latency, and errors. Change one factor at a time before testing combinations.

1. **A0:** reproduce current keyword-passage E5 q8 baseline, including the known failure pair.
2. **A1:** natural question examples, correct symmetric prompts, max aggregation.
3. **A2:** compare top-two mean and centroid; retain only supported benefits.
4. **A3:** lexical-only diagnostic and dense+lexical RRF, fixed small parameter grid.
5. **A4:** best retrieval shortlist → actual multilingual Laya; compare k=4 and k=8 plus none. Test option permutation and absent-answer rejection.
6. **A5:** development/calibration-fitted uncertainty gate; compare coverage at equal error risk.
7. **A6:** independently compare a small set of embedding candidates using the winning representation. Recheck the interaction between the chosen model and fusion/gating, without expanding into an uncontrolled full grid.
8. **A7, only if justified:** supervised local reranker/intent head using genuinely labeled Korean cases and hard negatives. Training may happen offline in Python with authorization; inference can remain local if the resulting supported weights are bundled. A tiny linear head over frozen embeddings is easier to ship than cross-encoder/Laya fine-tuning. Neither option is “no training,” and synthetic labels alone do not establish correctness.

Stop escalating complexity when the next method lacks a repeatable development gain, worsens a critical slice, or exceeds the agreed download/latency/memory budget. This is best-tested quality under stated constraints, not proof of a globally optimal search method.

## 6. Evaluation without leakage

Keep corpus-authoring examples, development queries, calibration queries, and untouched holdout separate. Split by **scenario/paraphrase group**, not random strings; all rewrites of one seed scenario belong in one split. Existing reported failures are development/regression cases. Public examples in these research notes must not be marketed as unseen tests.

An initial small fixture set is a smoke test. For a meaningful comparison, aim for at least dozens of independently authored scenarios spanning career, relationships, purchases, routine choices, and uncertainty, with multiple rewrites and hard contrasts per scenario. Increase data until confidence intervals support the intended claim; a fixed sample count does not guarantee adequacy. Recruit independent Korean judgments where possible. Use both (a) unseen wording for known intents and (b) unseen/OOD intent scenarios to test abstention.

Separate three targets:

- **Intent retrieval:** multi-label acceptable-intent top-1 accuracy, macro accuracy across intent families, Recall@4/@8, MRR; report per-slice errors. For a relevant set, success means any acceptable intent, not one arbitrary answer ID.
- **Answer suitability:** blinded ratings of compatibility (0 inappropriate, 1 tolerable, 2 good), contradiction/unsafe-direction rate, and pairwise preference. Allow multiple acceptable answers. Report rater disagreements and distinguish stylistic charm from factual decision quality.
- **Consistency/robustness:** uncached paraphrase intent agreement and answer-family agreement; changed-meaning minimal-pair discrimination; spacing/typo/honorific robustness; Laya option-order/label stability; abstention on OOD and missing candidates. Report both correctness and agreement, since consistently wrong outputs can look stable.

Operational metrics: cold-download bytes/time, first inference, warm p50/p95 query latency, model+index memory, corpus embedding time, repeated-query cache behavior, supported browsers/devices, and WASM versus WebGPU parity. q8 ranking changes must be tested, not assumed irrelevant.

Use paired comparisons and bootstrap confidence intervals **by scenario group**, not by correlated paraphrase. Prespecify a primary metric and acceptable regressions/resource limits before opening holdout. Choose on development, fit thresholds on calibration, then evaluate the locked winner and baseline once on holdout. If holdout reveals issues, disclose them, move that set to regression, and collect a fresh holdout for the next certification. Do not repeatedly tune on the same “test” set until the score looks good.

**Completion claim:** “Among the tested local configurations, X had the strongest held-out intent accuracy at Y coverage and Z latency on these devices,” with actual measurements, denominator, and uncertainty. If gains are inconclusive, choose the simpler/faster configuration and state that the larger method was not shown better. No method in this report has yet earned that claim.

## Implementation handoff: accompanying content

Use `retrieval-intents.ko.json` (22 families, 88 natural examples) as the question-example index, and `answers.ko.json` as the 100-answer presentation inventory. Their `eligibleAnswerIds` are suitability constraints, not objectively correct life decisions. The answer categories describe response functions (go/pass/wait/rethink/check/ask/small/priority/uncertain/play), not user intent classes. Retrieve an intent first, honor its risk route, and select only from compatible answer IDs after interpreting action direction. The supplied question fixtures and embedding benchmark are authored smoke/regression material, not empirical results. In particular, the user's already-known “이직할까?” / “직장을 옮길까요?” discrepancy is development/regression data, never an unseen holdout success.
