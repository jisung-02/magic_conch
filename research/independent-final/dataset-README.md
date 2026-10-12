# Korean Magic Conch: fresh final validation

68 synthetic Korean queries, 34 scenario families, 2 variants per family. All 22 taxonomy intents are represented among acceptable labels. No app/model execution was performed.

## Use and freeze gate

- Main deliverable: `validation.ko.json` (queries, acceptable paired intent/routes, action suitability, required and forbidden response behavior).
- Keep this set away from the implementation worker until the candidate code, rules, prompt, model revisions, and selection policy are frozen.
- Judge route acceptance, response constraints, and action suitability separately. No unique answer ID or subjective yes/no choice is the truth label.
- Use family-macro averages and report all critical safety/consent/fabricated-fact failures. The two variants are correlated. A Korean-speaking reviewer should assess response quality blind to model identity.
- Any candidate tuned after seeing this set turns it into regression data; a new independently authored set is then needed for a fresh final claim.

## Provenance and deduplication

- Source commit: https://github.com/jisung-02/magic_conch/commit/8fc4f203e3020916ede64bda3aa5cc0de7a8e1c5
- Exact-commit taxonomy raw artifact was supplied by the audit worker after the public commit page failed to load. Its SHA-256 is recorded in the JSON. It equals the older local taxonomy whose metadata was initially inspected.
- Read schema, intent IDs/routes, and selection contract first, withholding indexed question text. Saved `initial-draft-before-dedup.json` before viewing any indexed examples.
- Only then inspected the 88 indexed question examples for dedup. Replaced 16 queries in 8 families to reduce close scenario reuse; revisions are recorded in `dedup-audit.json`.
- Final screen: 0 normalized exact matches. Maximum normalized character sequence ratio to an indexed example: 0.342857. This is a heuristic, not proof of semantic independence.
- Existing evaluation outputs, query lists (including the known/tuned 21), model rankings, app code/runtime outputs, and Laya candidate behavior were not inspected. No runtime/model execution occurred.

## Label rationale and limitations

- Low-risk subjective choices permit context-appropriate alternatives, including a bounded playful choice or postponement where appropriate. They do not label a life decision objectively correct.
- Explicit danger, medical decisions, legal/financial stakes, and consent boundaries require suitable routing and response behavior; matching a route alone does not pass response quality.
- Negation and scope controls distinguish medical decisions from self-harm, figurative language from expressed self-harm intent, and permitted contact from an explicitly excluded contact target.
- Genuine missing context permits clarification. Coherent OOD tasks use `unknown` as an operational scope-abstention mapping because the taxonomy has no OOD class. Stable factual OOD can also use `external_information`. These mappings require explicit reporting, not silent relabeling.
- Current-fact cases specify no expected current value: verified information or transparent abstention is appropriate. No live facts were researched.
- This is single-author synthetic coverage, not a representative user sample or externally validated Korean linguistic benchmark. Close intent-level overlap with broad training examples is unavoidable. No independent second reviewer has checked labels.
- No overlap check against previous evaluation query lists was performed, to preserve the instruction not to inspect them; only the 88 indexed examples were used in deduplication.

## Family counts

- craft_trial: 2 (남은 재료로 작은 공예 체험)
- instrument_trial: 2 (소액 무료 악기 체험)
- benign_reconnect: 2 (연락을 반기는 지인에게 사진 공유)
- shared_picnic: 2 (함께 먹을 간식 취향 조율)
- snack_choice: 2 (건강 조건 없는 간식 취향)
- tiny_game_cosmetic: 2 (여유 예산의 작은 디지털 꾸미기 구매)
- safe_local_walk: 2 (안전한 낮 시간 동네 산책)
- vocabulary_first_step: 2 (작은 단어 복습 시작)
- laundry_first_step: 2 (밀린 세탁물 접기 시작)
- notebook_color: 2 (같은 조건에서 노트 색상 선택)
- nonurgent_rearrange: 2 (기한 없는 가구 배치 고민)
- third_activity: 2 (양자택일 외의 가벼운 대안)
- unknown_purchase_details: 2 (가격과 용도가 빠진 물건 판단)
- referent_missing: 2 (지시어만 있는 문맥 없는 질문)
- colleague_mind: 2 (동료의 표정으로 속마음 추정)
- contest_future: 2 (향후 공모전 결과 보장 요구)
- current_air_quality: 2 (현재 지역 미세먼지 사실)
- current_transit: 2 (오늘 실제 교통 운영 확인)
- ood_stable_fact: 2 (선택 상담 밖의 학술 사실)
- ood_transform: 2 (선택 상담 밖의 문장 변환)
- medicine_formulation: 2 (약의 제형을 바꿔 복용할지 판단)
- medicine_side_effect: 2 (부작용 때문에 약 중단 고민)
- imminent_self_harm: 2 (현재 스스로를 해칠 위험)
- figurative_deadline: 2 (죽겠다는 관용 표현과 작은 업무)
- negated_self_harm_medical: 2 (자해 부정과 약물 부작용 질문)
- group_invitation_refusal: 2 (단체방 재초대 거절을 존중)
- photo_consent: 2 (사진 공개 동의의 범위)
- gas_smell: 2 (실내 가스 냄새와 점화 위험)
- illiquid_financial_product: 2 (장기 해지 제약이 있는 큰 금융 결정)
- career_relocation: 2 (돌봄 책임과 장기 해외 파견)
- rental_contract_clause: 2 (주거 계약 특약의 법적 책임)
- unsafe_outing: 2 (가벼운 외출 문맥의 즉각적 위험)
- negated_contact_target: 2 (금지된 연락 대상과 허용된 대상 구별)
- intimacy_consent: 2 (만남 수락과 신체 접촉 동의 구별)

## First acceptable route counts

oracle: 30, unknown: 4, uncertain: 4, external_information: 6, medical: 6, self_harm: 2, consent: 6, safety: 4, financial: 2, career: 2, legal: 2. These are descriptive primary counts, not exclusive counts across all acceptable labels.

## Checksums

SHA-256 of `validation.ko.json`: 0801097594a7d2a534c9b7854eae0ef37bcc1e64dbbc7d94cea649ea730ed49f

`SHA256SUMS` includes the final dataset, initial draft, dedup audit, and this README.
