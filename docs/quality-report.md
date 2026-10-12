# 한국어 검색 및 Laya 검증 (2026-10-10)

이 보고서는 직접 작성한 소규모 smoke/dev/holdout 평가입니다. 절대 최고 품질이나 실제 상담 정확도를 입증하지 않습니다. 평가 문장은 질문 주제·의도 라벨이며, 인생의 객관적인 정답이 아닙니다.

## 데이터와 검색 구조

원작 한국어 답 100개와 안내 8개, 의도 22개별 자연질문 4개(88개)를 사용합니다. 책의 전문을 추출·번역·의역하지 않았습니다. 특정 '마법의 소라고둥책' 제목은 미확정입니다. 출판사/서점에서 확인한 질문–짧은 답 형식을 참고했습니다. 출처와 작성 경위는 `research/README.md` 및 `research/answers.ko.json`에 있습니다.

기존 E5 모드는 query/passage, 384차원으로 개인 JSON/SQLite 선택지를 계속 검색합니다. 새 한국어 모드는 `anpigon/ko-sroberta-multitask` q8 (`ba6ffa9571bf149f8131138929500bff0b7e088d`), prefix 없음, attention-mask mean pooling, normalize, 768차원으로 질문–질문을 비교합니다. 질문 예시의 최대 cosine 75%와 의도 centroid cosine 25%를 합칩니다. 의도에 맞는 원래 답 후보만 사용하고, 큰 결정에는 안내 답을 제공합니다. 이 합산 점수는 확률이 아닙니다. 모델 원저자는 jhgan이며 커뮤니티 ONNX 배포자의 모델 카드에는 별도 license 필드가 없으므로 상업적 재배포 권리를 주장하지 않습니다. 한국어 모델 가중치는 저장소에 재배포하지 않고 opt-in 후 해당 공개 Hub에서 내려받습니다.

## 실제 실험

| 설정 | dev 의도 top1 /20 | dev 문장 대비 /8 | dev 12주제 검색 /12 |
|---|---:|---:|---:|
| E5 natural max |16|1|11|
| E5 centroid |19|1|11|
| 한국어 SRoBERTa max |19|7|12|
| 한국어 SRoBERTa top2 |18|7|12|
| 한국어 SRoBERTa centroid |18|7|12|
| 한국어 SRoBERTa + 문자 RRF20/60 |17|7|12|
| MiniLM max |12|7|9|
| 한국어 SRoBERTa 0.75 max + 0.25 centroid |20|7|12|

RRF와 top2/centroid는 이 dev셋에서 개선을 보이지 않아 선택하지 않았습니다. 모델 3개, 집계 3종, 문자 검색, RRF 2종, 제한된 혼합 비율을 비교했습니다. 알려진 이직 질문쌍은 dev/regression으로 포함했으며 새 holdout 성공으로 세지 않았습니다. 기존 12개 keyword passage E5가 이직 질문쌍에 서로 다른 부적절한 답을 내던 공개 브라우저 결과는 baseline 사례로 보존했습니다.

선택 후 설정을 먼저 `research/results/frozen-configuration.json`에 고정했습니다. 분리 시나리오 7개×3표현 21개에서 top1 16/21, top3 21/21입니다. 별도 문장 대비 holdout 7/8, 별도 주제 검색 holdout 12/12입니다. 아직 작고 관련된 paraphrase가 묶인 authored test이므로 신뢰구간이나 일반 성능을 주장하지 않습니다.

오류: 내일 날씨는 factual_current와 unverifiable_future 경계; 약 중단 표현 하나는 self_harm_concern으로 분류; 반복 연락 표현 하나는 casual_contact로 분류했습니다. 마지막 오류는 실제 문맥/경계 판단의 한계입니다. 이 결과를 보고 corpus/가중치를 다시 튜닝한 뒤 같은 데이터를 미사용 holdout이라고 부르지 않았습니다. 더 개선하려면 독립적인 새 시나리오와 사람의 답 적합성 평가가 필요합니다.

## 실제 Laya와 경량화

공식 `convaiinnovations/laya-multilingual@e4e9ddf21a7b1903b7acffd8814ad4307bf63a67`, 학습된 mmBERT-base 322M와 decision head 전체를 사용합니다. 공식 source `68804629e8ccd9d616d48a40e87de9fabbeae069` export에 strict checkpoint load를 적용했으며 모든 key가 일치했습니다. FP32 ONNX는 16/512토큰, batch1/2에서 PyTorch logits/act 출력과 1e-4 이내(최대 logits 차이 2.1e-6)로 일치했습니다.

INT8 MatMul/Gather 실험: 약404MB로 작지만 한국어 15개에서 FP32 선택 일치 2/15, 최대 분포 차이0.4066이라 폐기했습니다. 생산 모델로 사용하지 않습니다.

최종 가중치는 FP16 저장 후 Cast로 원래 FP32를 정확히 복원합니다. 모든 압축 tensor에 bit-exact FP32 복원 assertion을 적용하고, 연산은 FP32로 유지합니다. 15개 한국어 질문에서 FP32와 선택15/15, 최대 분포 차이0입니다. 모델/토크나이저 합계 약681MB이며 런타임은 별도 약14MB입니다. Chrome 로딩 후 탭 메모리 약2.9GB, 한국어 모델 동시 로드 후 약3.2GB로 표시됐습니다. 로컬 Chrome 실제 Laya 추론 약2초가 관측됐습니다. Python ORT 2thread의 약0.68초를 브라우저 속도라고 표시하지 않습니다. 모바일 WASM은 검증하지 않았습니다.

4/8 intent 후보+NONE으로 실제 Laya decision rerank를 비교한 dev20개는 각각4/20이며, 옵션 역순 시 결과 일치는12/20·13/20입니다. 그래서 Laya를 기본 권장 검색으로 바꾸지 않았습니다. 선택적 실험 모드로 제공하며, 실제 학습된 head로 DB 답 후보를 평가합니다. 한국어 검색을 켰다면 의미 후보를, 그렇지 않으면 명확히 표시된 키워드 후보를 사용합니다. NONE이면 안내를 표시하며 그 안내를 생성된 DB 답으로 가장하지 않습니다.

## 호스팅/재현

Apache-2.0 모델과 upstream 라이선스/NOTICE를 함께 제공합니다. 임시 Actions의 GITHUB_TOKEN으로 Release 자산을 게시했습니다. 새 개인 토큰이나 영구 계정 권한을 만들지 않았습니다. 원본/ONNX 가중치는 Git 커밋에 넣지 않습니다. 부모 Pages 빌드는 고정 Release archive SHA256을 검증하고 모델을 정적 사이트에 복사합니다. 브라우저 모델 자산은 같은 origin `/magic_conch/models/laya/`에서 받아 CORS 중계를 피합니다. 전체 Pages 크기를1GB 아래에서 검사합니다. 질문/DB/후보는 어떤 추론 서버에도 보내지 않습니다.

실측 JSON과 스크립트는 `research/results/` 및 `research/laya/`에 있습니다. 원시 점수·오류·latency를 보존합니다. 아직 전체 배포 URL 검증 결과는 후속 배포 기록에 추가해야 합니다.
