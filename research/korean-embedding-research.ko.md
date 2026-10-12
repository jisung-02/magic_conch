# 마법의 소라고동: 한국어 문장 임베딩 선정

조사일: 2026-10-10. 모델 카드·공개 파일 목록을 조사했다. 이 문서에는 직접 실행한 모델 정확도/속도 측정이 없다. 아래 숫자는 출처가 보고한 평가 또는 저장소에 표시된 파일 크기이며, 앱의 품질 보증이 아니다.

## 결론

1. **한국어 자연문장끼리 같은 의도를 찾는 용도라면 `jhgan/ko-sroberta-multitask`를 첫 비교 후보로 추천한다.** 한국어 KorNLI+KorSTS 학습, KorSTS cosine Spearman 85.60을 보고한다. 커뮤니티 `anpigon/ko-sroberta-multitask`에 111MB q8 ONNX와 752kB tokenizer.json이 있어 다운로드는 현재 E5-small보다 약간 작다. 다만 브라우저 실행 검증은 별도이며, 768차원/12층 모델이라 파일 크기가 비슷하다고 E5-small 384차원보다 빠르다는 뜻은 아니다. 원본 대비 변환·양자화 정확도도 검증해야 한다. [원본](https://huggingface.co/jhgan/ko-sroberta-multitask) · [ONNX](https://huggingface.co/anpigon/ko-sroberta-multitask/tree/main/onnx) · [토크나이저](https://huggingface.co/anpigon/ko-sroberta-multitask/tree/main)
2. **현재 `multilingual-e5-small`은 대조군으로 남긴다.** 한국어 미지원 모델이 아니다. Mr. TyDi 한국어 MRR@10은 small 54.3/base 55.8로 보고된다. 질문↔질문 패러프레이즈에는 양쪽 모두 `query: `, 질문→설명문 검색에는 `query: `/`passage: `를 써야 한다. keyword-list를 긴 passage 하나로 만들고 top1만 고르는 현재 방식과 모델 자체의 문제를 분리해서 비교해야 한다. [공식 지침/평가](https://huggingface.co/intfloat/multilingual-e5-small)
3. **다운로드 최소화 후보는 `exp-models/dragonkue-KoEn-E5-Tiny`.** 한국어·영어 검색용 37M 모델이며, 공개 파일은 fp32 ONNX 150MB / O4 74.9MB / `model_qint8_arm64.onnx` 38.3MB, tokenizer.json 2.93MB다. 이 파일명이 Transformers.js 기본 q8 이름과 다르며 ARM64 대상 양자화가 WASM/WebGPU 호환을 보증하지 않는다. 재변환 또는 호환성 테스트가 필요하다. 모델 카드 예제에 원본 small-ko ID가 남아 있으므로 그대로 복사하지 말 것. [카드](https://huggingface.co/exp-models/dragonkue-KoEn-E5-Tiny) · [실제 ONNX 파일](https://huggingface.co/exp-models/dragonkue-KoEn-E5-Tiny/tree/main/onnx) · [토크나이저 포함 파일 목록](https://huggingface.co/exp-models/dragonkue-KoEn-E5-Tiny/tree/4c58635599cdecef58f19db20a776393a1dcc635)

## 다른 후보와 제외/후순위 이유

- `jhgan/ko-sbert-multitask`: 동일 한국어 학습 계열, KorSTS cosine Spearman 84.71. 원본 PyTorch 443MB이며 이번 조사에서 표준 브라우저 q8 배포를 확인하지 못했다. ko-sroberta 대비 우선할 명확한 근거가 부족하다. [원본/평가](https://huggingface.co/jhgan/ko-sbert-multitask) · [파일](https://huggingface.co/jhgan/ko-sbert-multitask/tree/main)
- `Xenova/paraphrase-multilingual-MiniLM-L12-v2`: 패러프레이즈 목적의 다국어 384차원 대조군. Transformers.js용 q8 118MB, fp32 470MB가 실제 존재한다. 작은 영어 MiniLM의 20~30MB급 모델과 혼동하면 안 된다. 한국어 문서 검색에서는 아래 동일 평가의 NDCG@10이 0.409766으로 낮지만, 이것만으로 한국어 짧은 패러프레이즈도 나쁘다고 결론낼 수는 없다. [원본](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2) · [배포 파일](https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2/tree/main/onnx)
- `Xenova/multilingual-e5-base`: 768차원. 브라우저용 int8 278MB/기존 quantized 279MB, fp32 1.11GB. 비용이 크게 늘어나므로 small보다 앱 테스트에서 확실히 좋아질 때만 고려한다. [파일](https://huggingface.co/Xenova/multilingual-e5-base/tree/main/onnx)
- `dragonkue/multilingual-e5-small-ko-v2`: 한국어 query-passage 추가학습. 같은 작성자 평가의 7개 한국어 retrieval 평균 NDCG@10: ko-v2 0.692511, E5-base 0.689429, Tiny 0.687496, 기본 small 0.670906. 이 비교는 검색 성능이며 STS/부정문 이해 점수가 아니다. 원본 저장소에는 471MB safetensors + tokenizer 17.1MB가 있고 ONNX 배포는 확인하지 못했다. 추후 직접 ONNX 변환을 한다면 좋은 검색 후보다. [평가](https://huggingface.co/dragonkue/multilingual-e5-small-ko-v2) · [파일](https://huggingface.co/dragonkue/multilingual-e5-small-ko-v2/tree/main)
- `ibm-granite/granite-embedding-107m-multilingual`: 한국어 포함 12언어, 384차원, **CLS pooling**. IBM 카드의 한국어 MTEB retrieval 1개 태스크 70.5는 다른 STS/7개 평균과 직접 비교 불가. 커뮤니티 `yuiseki/...-ONNX`에 Transformers.js 사용 예와 q8 약 102MB(카드 표기)가 있다. 다른 변환 repo 실제 목록은 107MB decimal + tokenizer 17.1MB. 카드 MB/MiB 혼용을 고려하고 실제 전송량은 브라우저에서 측정해야 한다. 한국어 특화/문장 동등성 1순위보다 보조 경량 후보. [IBM](https://huggingface.co/ibm-granite/granite-embedding-107m-multilingual) · [JS 변환 카드](https://huggingface.co/yuiseki/granite-embedding-107m-multilingual-ONNX) · [다른 변환 실제 파일](https://huggingface.co/keisuke-miyako/granite-embedding-107m-multilingual-onnx-int8/tree/main)
- `nlpai-lab/KoE5`, `KURE-v1`, 한국어 BGE-m3/Snowflake 계열은 한국어 검색 후보지만 약 560~568M 규모다. 현 앱의 가벼운 첫 실행에는 과하다. 검색 강점을 부정/농담/답변 선택 능력으로 해석하지 않는다. [KoE5](https://huggingface.co/nlpai-lab/KoE5) · [KURE](https://huggingface.co/nlpai-lab/KURE-v1)

## 모델 교체만으로 해결되지 않는 부분

- `직장을 옮길까요?`와 `이직할까?`는 같은 intent이지만, `이직하지 않을까?`처럼 제안/추측/부정 의문문은 문맥에 따라 다르다. 부정 조사 삭제나 키워드 치환으로 강제 동일화하지 않는다.
- 임베딩 cosine은 관련성이지 논리적 동의나 정답 확률이 아니다. E5는 공식적으로 점수가 0.7~1.0에 몰릴 수 있다. 모든 모델에 공통 `0.8 이상이면 확신` 규칙을 쓰지 않는다.
- 사용자가 올린 답이 `응`, `아니`, `나중에`, `그만둬`뿐이면 query와의 의미 유사도로 정답을 정할 근거가 없다. 질문-답변 적합성 및 캐릭터 응답 선택은 별도 단계다.
- 후보별로 짧은 자연문장 설명과 다양한 사용 예시를 별도 레코드로 저장한다. 예: `직장을 옮길지 고민한다`, `이직할까?`, `다른 회사로 옮겨도 될까요?`. 긴 키워드 주머니 하나로 합치지 말고 후보 ID별 최고/상위 평균 점수를 비교한다. 새 업로드에는 개발자가 고른 직장/연애 태그만 강제하지 않는다.
- 사용자 업로드 본문에 후보 설명이 없으면 임의 의도를 꾸며내지 않는다. 업로드 텍스트 그대로 검색하는 모드와 사용자가 선택 기준/예시를 추가하는 모드를 구분한다.

## 권장 구조

작은 후보 집합이면 모든 후보를 Laya에 전달할 수 있는지 먼저 검토한다. 후보가 많으면 임베딩 top3~5를 조회하고 Laya가 원 질문, 후보 원문/설명, 부정/조건을 함께 보고 후보 ID만 선택하도록 한다. 출력 ID가 실제 업로드 목록에 존재하는지 검증한다. 낮은 관련성/좁은 점수차/순위 불안정 시 추가 후보를 포함하거나 '판단 어려움' 경로로 보낸다. 검색에서 빠진 정답을 Laya가 복구할 수 없으므로 recall@k가 중요하다. Laya의 실제 한국어 선택 능력은 이 조사에서 검증하지 않았다. 사용자가 클라우드 없는 실행을 요구하면 Laya도 로컬이어야 하며 암묵적 서버 호출을 추가하면 안 된다.

## 최소 비교 실험 (제공한 JSON 사용)

A. 기본 E5-small + 기존 keyword corpus
B. 기본 E5-small + 자연문장 corpus / 올바른 query-query prefix
C. ko-sroberta q8 + 동일 자연문장 corpus
D. multilingual MiniLM q8 + 동일 corpus
E. Tiny q8는 브라우저 호환 통과 후 추가

1. `pairs`: 16개 패러프레이즈와 16개 부정/대조 쌍. 같은 anchor의 긍정 패러프레이즈가 부정 대조보다 높은지 16개 triplet 순위 정확도를 기록한다. 부정문의 유사도가 무조건 0에 가까워야 한다는 기준은 쓰지 않는다.
2. `retrieval_cases`: 24개 질문을 제공 corpus에 검색. 후보 top1 정확도, recall@3, 같은 intent의 표현별 top1 일치율을 기록한다. 대명사/빈 문맥/OOD 4개는 abstention 점검에 쓴다. 사람 검토용 작은 스모크 테스트이며 일반화 벤치마크가 아니다. 품질 임계값 튜닝과 최종 평가는 분리하고, 실제 사용자 선택지로 별도 holdout을 만든다.
3. 차원/finite 값/L2 norm/토크나이저 UNK율, 문장 길이/잘림, prefix, pooling을 점검한다. ko-sroberta는 masked mean+normalize, max128; E5는 masked mean+normalize, max512; Granite는 CLS+normalize다.
4. 동일 기기/브라우저에서 최초 다운로드 실제 bytes, cold ready, warm 1문장 p50/p95, corpus 인덱싱 시간, peak memory를 기록한다. q8 WASM을 먼저 통과시키고 WebGPU는 별도 검증. 서버용 ONNX, ARM64 최적화, GGUF가 존재한다고 browser-compatible은 아니다.
5. runtime/model revision/dtype/backend/tokenizer revision을 함께 기록하고 각 모델 인덱스를 새로 만든다. 기존 모델 벡터를 재사용하면 안 된다. 모델은 하나씩 로드/해제한다.

실제 E5-small ONNX: q8 118MB, fp16 235MB, q4 399MB. q4라는 이름만 보고 다운로드가 더 작다고 가정하지 않는다. [파일](https://huggingface.co/Xenova/multilingual-e5-small/tree/main/onnx) · [Transformers.js dtype](https://huggingface.co/docs/transformers.js/guides/dtypes) · [WebGPU 지침](https://huggingface.co/docs/transformers.js/guides/webgpu)
