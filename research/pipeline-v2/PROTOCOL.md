# Pipeline v2 development protocol

No production deployment or merge. Preserve d117 frozen results and b622 candidate. The previously candidate-blind68 queries are now regression/dev, not independent final validation.

Compare three profiles:
A: frozen v1, 88 natural examples, .75 max+.25 centroid, global .06 protected conflict, original first-compatible responses.
B: same88 examples, context evidence and scope exclusions, protected routes locked before Laya; retain original everyday reply selection. Diagnose context routing separately.
C: B plus expanded developer examples, route-specific acceptance and lexical/dense combination, suitable short responses. Report component removals (no expansion, no lexical, no path thresholds) as additional ablations, not new models.

All candidate changes are generic language/domain policies, not case-ID or exact-question matches. Explicit negation, quoted transformations, figurative expressions and excluded contact targets are included in the developer stress set. Rule/label changes after results are development. No population performance claim. Final candidate will be frozen only after improvement stalls; a fresh candidate-blind validation is then needed.

CPU measurements use the verified Ko-SRoBERTa pin and existing caches. Laya's trained head is diagnostic/experimental for everyday choices; cannot remove protected routing on NONE/error. Report retrieval, final routing, answer constraints, inappropriate abstention, critical direction separately. Developer semantic review is provisional and unblinded. Preserve raw scores, all variants and failures.

Independent component ablations requested by parent: H = baseline88 + hierarchical route backoff/precedence only; E = expanded examples + frozen global routing only. Full C also adds scoped evidence, route-specific acceptance and short responses. Protected top1 must not become unknown merely because another protected sub-intent is close. Gates inspect all22 scores. Hierarchical backoff is an app-specific hypothesis inspired by https://proceedings.neurips.cc/paper_files/paper/2024/hash/c8b100b376a7b338c84801b699935098-Abstract-Conference.html ; this is not a reproduction of its algorithms or guarantees (the paper's empirical study uses ImageNet classifiers).
