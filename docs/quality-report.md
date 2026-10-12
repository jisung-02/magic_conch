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

## 최초 후보 8fc4f20의 재현 계약과 당시 배포 상태

최초 후보 8fc4f20의 한국어 검색은 prefix 없음, q8, 768차원, attention-mask mean pooling과 L2 normalize, truncation/max_length=128, `0.75 × 최대 예시 cosine + 0.25 × centroid cosine`입니다. **별도의 score threshold나 top1–top2 margin gate는 구현하지 않았습니다.** 점수가 낮아도 top1 의도를 선택하므로 out-of-domain/명확화와 위험 질문 처리를 보장하지 않습니다. E5의 기존 threshold를 한국어 모델에 옮기지 않았고, 이 항목은 후속 독립 데이터로 calibration해야 합니다.

최초 후보 8fc4f20의 기본 샘플은 독자적으로 작성한 답 100개 + 안내 8개이며 JSON/SQLite/앱 내 데이터에 반영했습니다. 22의도×4자연질문=88개가 검색 인덱스입니다. 기존 IndexedDB 파일은 자동 교체하지 않습니다. 한국어 모드는 제공된 108개 기본 데이터에 적용하며, 사용자 파일은 기존 E5 또는 Laya/키워드 경로를 사용합니다.

첫 후보 실패 5개(괄호는 기대→실제):
- `내일 비 안 오겠지?` (unverifiable_future→factual_current)
- `내일 비가 오는 건 아니겠지?` (unverifiable_future→factual_current)
- `내일 우산 필요 없을까?` (unverifiable_future→factual_current)
- `이 약 오늘부터 그만 먹을까?` (medical_decision→self_harm_concern)
- `답 올 때까지 계속 보내면 되겠지?` (consent_boundary→casual_contact)

18개 dev 문장(6시나리오×3표현)에 알려진 이직 질문 2개를 더해 20개에서 모델/집계를 선택했습니다. 그 후 7개 다른 시나리오×3표현=21개로 고정 설정을 평가했습니다. 이것은 같은 저자가 작성한 작은 평가이며 corpus와 주제 수준에서 독립적이지 않습니다. 별도 blinded human validation/test set은 없습니다. 저장된 frozen 결과는 후속 재실행을 새 미사용 holdout으로 계산하지 않습니다. 표현은 "시험 범위에서 best-tested"가 맞습니다.

재현 명령(프로젝트 루트; 모델 다운로드는 공개 Hub 네트워크가 필요하며 임베딩 시간은 CPU 결과입니다):

```sh
npm ci
npm test
npm run build
node research/benchmark-embeddings.mjs
node research/evaluate-retrieval-dev.mjs
node research/evaluate-aggregation-grid.mjs
node research/evaluate-frozen-holdout.mjs
npm run prepare:laya-assets
```

`benchmark-embeddings.mjs`/dev 비교는 저장 당시 모델 ID의 Hub 기본 revision으로 실행했습니다. 원본 결과 JSON에는 revision이 없으므로 모든 후보에 대한 byte-identical 역사 재현을 주장하지 않습니다. 최종 앱과 frozen 평가의 Ko-SRoBERTa revision은 고정했습니다. 집계 grid는 저장된 dev 점수로 네트워크 없이 원래 결과를 다시 확인합니다. 각 후보의 max/top2/centroid/RRF 결과는 `research/results/dev-comparison.json`, 제한된 grid는 `research/evaluate-aggregation-grid.mjs`, 최종 선택 기록은 `frozen-configuration.json`, 실패/원시 순위는 `frozen-holdout.json`에 있습니다.

Laya export 재현은 `.github/workflows/laya-model.yml`의 고정 Python/dependency 설치 후 새 작업 디렉터리에서 `python scripts/export-laya-model.py`입니다. checkpoint/source SHA를 고정하고 trained state_dict 전체를 strict load합니다. PyTorch→FP32 ONNX 검증은 upstream exporter의 16/512토큰×batch1/2 검사입니다. 압축 모델 parity는 export 후 다음으로 재현합니다:

```sh
python research/laya/reproduce-packed-parity.py --model-root . --output /tmp/laya-parity-recheck.json
```

역사 parity 입력은 기존 12개 DB에서 선택한 8개 답 후보와 15개 한국어 질문입니다. 새 108개 corpus의 품질 평가와 구분합니다. `research/laya/packed-parity.json`은 선택15/15 일치와 분포 차이0, `onnx-parity.json`은 폐기한 INT8 선택2/15, `shortlist-results.json`은 실제 Laya 후보4/8개 의도 rerank 각각4/20 및 순서 일치12/20·13/20을 기록합니다. 마지막 실험은 일반 DB 답 후보 품질을 직접 측정하는 검증이 아닙니다.

공개 Release archive는 602,959,747bytes, SHA256 `cbba8cba793dc8e9901e3534007ade46ab5107bf16ba6994186502f5c4b8f014`이며 준비 스크립트가 다운로드·archive·각 파일 SHA/size를 검증합니다. CI 산출물 manifest totalBytes는 680,935,309이며 로컬 exporter의 680,984,617bytes와 작은 protobuf 차이가 있습니다. 약681MB 모델과 실행 파일을 Pages 같은 origin에서 제공하는 배포 브랜치를 올렸습니다. 앱/블로그 최종 빌드 통과 및 로컬 사이트 크기796,265,549bytes(별도 game build 제외) 확인; 완성 CI는 게임까지 포함한 dist 전체를1GB 아래인지 검사합니다. 현재 GitHub PR/배포가 완료되지 않았으므로 새 버전의 production URL·최종 브라우저 검증은 **미실행**입니다. 이전 로컬 Chrome의 명시적 모델 다운로드/한국어 질문/반복 Laya 추론1.39–2.00초 확인과 최종 max_length128 빌드 검증을 구분합니다.

재현 감사 후 `research/embedding-specs.mjs`에 후보3개 revision을 명시했으며 이후 benchmark/dev pipeline에도 실제 `revision` 인자를 전달하고 결과 metadata에 저장합니다. frozen pipeline도 실제 인자를 추가했습니다. 이 수정 전에 저장된 역사 dev/holdout JSON은 pipeline revision 증빙이 없으므로 메타데이터의 revision만으로 실제 가중치 revision이 검증됐다고 주장하지 않습니다. 런타임 Ko/E5는 처음부터 revision pin을 사용했습니다. 집계 regression 테스트는 같은 예시 벡터에서 max=1, top2=0.5, centroid=1/√10, balanced=0.75+0.25/√10을 구분해 검증합니다. 품질 점수는 보관된 측정값 그대로이며, 새 pin으로 전체 재측정한 성적은 아닙니다.

## 동결 후보 b6224b70의 후속 수정 및 평가 범위

기존21개 frozen 결과를 보고 앱을 수정했으므로 그 세트는 이제 회귀/dev 근거입니다. 위16/21을 수정된 앱의 새 검증 성적이라고 재사용하지 않습니다. 기존21문항은7시나리오의3변형이며 독립21상황이 아닙니다. 문장 대비7/8과 주제 검색12/12도 해당 과거 설정의 별도 측정값입니다. 주제 평가의 out-of-domain4개는12/12 분모에서 제외됐으며 abstention 검증에 포함되지 않았습니다.

최종 후속 규칙은 상위3의도 중 top1과 점수 차이가0.06 이하이고, high/urgent/boundary 의도와 서로 다른 응답 경로가 경쟁하면 한국어 답을 `route_unknown`으로 보류합니다. Laya에는 경쟁하는 보호 의도의 원래 안내 답들과 질문 확인 답만 전달하고, 일반 행동 권유 후보는 제외합니다.0.06은 회귀 오류를 바탕으로 정한 개발용 보수 규칙이며 보정된 margin이나 최적값이 아닙니다. score threshold는 여전히 없습니다. 이 정책은 독립적인 안전 분류기를 대체하지 않습니다.

`factual_current`에 별도 `route_external` 안내를 추가해, 날씨·영업시간 등은 공식 예보/최신 안내 확인을 권합니다. 총 기본 데이터는 이제100일반답+9안내=109개(JSON/SQLite/앱 반영), 의도22개/질문예시88개입니다. 한국어 모드는 일반답100개 중 첫 compatible 답12개만 현재 도달하며, Laya 일반답 후보에는43개가 연결됩니다. 전체100개가 답 선택 경로에서 모두 사용된다고 주장하지 않습니다. 표현 일관성을 해치는 임의 무작위 확장도 하지 않았습니다. 기존 사용자 IndexedDB는 자동 교체하지 않으며 원하면 명시적으로 기본값 복원할 수 있습니다.

후속 평가 입력은 `research/final-answer-validation.json`의 새16개 authored 질문으로 최초 실행 전 고정했습니다. 같은 작업자가 설계한 smoke validation이며 blinded human 평가가 아닙니다. 앞선 세트를 보고 만든 규칙의 일반 성능이나 '최고 품질'을 보증하지 않습니다. `research/evaluate-final-answer-flow.mjs`는 실제 앱의 `planBuiltinAnswer`를 사용해 DB 원래 답과 Laya에 전달하는 shipping answer 후보를 함께 기록합니다. `research/laya/evaluate-shipping-answer-flow.py`는 그 후보에서 학습된 encoder/head의 실제 답을 선택합니다. 예전4/20은 intent-label shortlist 실험이며 shipping answer-candidate 정확도가 아닙니다. strict 답 적합성과 추가 보류 횟수는 구분합니다. Node/Python CPU 평가이며 최종 브라우저 검증은 미실행입니다.

기존 캐시4파일(config/tokenizer/tokenizer_config/q8 ONNX)을 고정 revision의 공개 Git-blob SHA1/LFS SHA256과 비교한 기록은 `research/results/ko-cache-verification.json`입니다. 이를 현재 확인한 사실과 과거 측정 당시 증빙 부족을 구분합니다. 후속 평가는 모델을 다시 받지 않고 검증한 캐시로 실행하며,88예시 벡터를 다시 계산해 과거 벡터와 차이를 기록합니다.

```sh
# 온라인 실행: pinned revision을 실제 pipeline 인자로 전달
node research/evaluate-final-answer-flow.mjs ../../laya-onnx-packed
# 기존 검증된 캐시 파일/verified-pin symlink 디렉터리가 준비된 이 Mac에서는
CONCH_VERIFIED_CACHE=1 node research/evaluate-final-answer-flow.mjs ../../laya-onnx-packed
# 상위 명령이 출력한 실제 DB-answer 후보를 학습된 Laya head로 평가
python research/laya/evaluate-shipping-answer-flow.py --model-root ../..
```

Laya 모델 Release는 이제 기존 자산을 재사용하고 `--clobber`로 덮어쓰지 않습니다. 변경한 모델은 별도 버전 tag와 소비자 checksum을 갱신해야 합니다. npm build만으로 가중치가 포함되지 않으므로 deploy workflow의 `prepare:laya-assets`가 필수입니다. 같은 origin manifest/모델 HTTP 제공 확인은 실제 Pages 배포 후 해야 하며 현재 미실행입니다.

새16개 authored 답-path 검증: 한국어 strict 답 범주12/16, 추가 질문 확인 보류3/16, 나머지1/16은 새 이어폰 질문을 missing_details/check_01로 분류했습니다. 보류는 정답으로 합산하지 않습니다. 같은 pinned 파일로88예시를 재계산한 과거 index 최대 차이는0이며 그 결과와 실제 답/후보/오류는 `research/results/final-answer-flow.json`에 있습니다. 이는 후속 코드의 첫 smoke 결과이며 blinded validation 성적이 아닙니다.

최종 shipping Laya 후보의 실제 학습 head를 사용한16문항 CPU smoke 결과는 strict 답 범주2/16, 추가 NONE/질문확인 보류14/16입니다(`research/results/laya-final-answer-flow.json`). 보류를 적합한 정답으로 합산하지 않았습니다. 이는 예전 의도 라벨4/20과 구분되며 Laya의 우수성을 뒷받침하지 않습니다. 기존15개 packed parity를 다시 실행한 결과도 선택15/15·최대 분포 차이0이며 `/tmp/laya-packed-parity-recheck.json`에 보관했습니다.

## 새 최종평가: 동결 b622 (수정 전 정상 경로)

부모가 별도 작성한34가족×2변형=68문항을 b6224b70 후보 동결 뒤 전달했습니다. 작성자는 taxonomy만 읽고 후보 코드·이전 평가 질문/출력을 보지 않았으며, 색인88예시와 중복만 후속 제거했습니다. 단일 작성자 합성 자료이며 대표성 있는 외부 벤치마크가 아닙니다. 데이터 SHA256은0801097594a7d2a534c9b7854eae0ef37bcc1e64dbbc7d94cea649ea730ed49f입니다.

Node CPU 검색/실제 Python ORT trained-head 실행의 raw 결과를 `research/independent-final/`에 보존했습니다. OOD4문항은 의도/paired accuracy에서만 제외하고 허용 경로/출력 조건에는 포함했습니다. 검색 raw top1은46/64(32가족 macro71.875%), top3는56/64(87.5%)입니다. 최종 응답의 paired intent/route는 한국어34/64(53.125%)·Laya12/64(18.75%), 허용 경로는44/68(34가족 macro64.706%)·19/68(27.941%)입니다. Laya raw intent 점수는 공유 검색의 점수이며 Laya head의 별도 분류 정확도가 아닙니다. 보류20/68·48/68을 정답으로 합산하지 않았습니다. OOD 허용 경로는 각각2/4이나 적절한 범위 안내인지 여부는 별도입니다.

답변 조건/행동 적합성은 **눈가림 없는 assistant 예비 검토**만 완료했습니다. 한국어 조건29/68(가족macro42.647%)·행동35/68(51.471%), Laya 조건13/68(19.118%)·행동15/68(22.059%)이며 확인된 사람 평가 성적이 아닙니다.136개 익명 출력의 한국어 사용자 눈가림 검토는 미실행입니다. 라벨을 결과에 맞춰 바꾸지 않았고 애매한 경계는 REPORT와 예비 검토 JSON에 별도로 표시했습니다.

사진 공개 거절 문맥에 한국어 FCV-054 '전부 말고 조금만 해 봐', Laya FCV-053 '일단 초안까지만 가 보자'/054 '끝까지 말고 첫 단계만'이 나왔습니다. 가스·침수 위험과 즉각적 자해에 필요한 안내를 빠뜨린 보류도 있습니다. 이 결과는 b622를 최고 품질/게시 최종본으로 승인하지 못하게 합니다. 생성한 현재 수치/운행 사실 조작은 관측하지 않았습니다. 질문별 실패를 사용해 검색 예시·가중치·margin·라벨을 튜닝하지 않았습니다.

`raw-retrieval.json`은 top3/route/원래 DB 답/후보/토큰, `raw-laya.json`은 실제 head 선택/분포/답/보류 이유, `scored-classification.json`은 가족별·분모별 자동 평가, `provisional-response-review.json`은 예비 내용 검토, `blind-review.json`은 모델 이름을 가린 검토 입력입니다. REPORT.md에 방법·재현 명령·누락된 눈가림 검토를 명시했습니다. 모델 하네스의 오류 수정 재실행 없이 각 모델 경로를 한 번 실행했고, 점수/검토 하네스는 raw 실행 뒤 추가했습니다. Library 결과 파일ID는 libfile_21d9a128719c8191984fc78107b07f5b입니다.

## 별도 모델 오류 복구 수정

동결 평가 뒤 오류 복구 경로를 별도 수정했습니다. Laya 오류/90초 timeout이면 이미 계산한 보호 계획의 안내를 유지하고, 계획 전 임베딩/다운로드 실패는 명시적 모델 오류·확인 안내로 끝냅니다. 다음 질문에서도 자동 전체 DB 키워드/무작위 검색을 막으며 사용자가 명시적으로 재시도/다른 모드를 선택해야 해제됩니다. E5 로딩/추론 실패도 같은 원칙으로 처리합니다. 정상 검색 예시·후보 정책·임계값·모델 prompt/가중치는 b622 그대로입니다. 따라서 새68문항 정상 경로의 약점은 그대로 남아 있습니다.

26개 테스트 통과: Laya 오류/timeout, 계획 전 한국어 임베딩/다운로드 실패, E5 load/inference 실패를 주입해 보류와 재시도를 검증했습니다. 모델 실패시 임의 DB record가 안전 답으로 위장하지 못하는 것도 검증했습니다.68문항의 저장된 query ranking/실제 head 결과를 정상 인터페이스에 다시 공급하는 **회귀 replay**에서 한국어 답·Laya 후보/답이 모두 동일했습니다. 실제 모델을 다시 측정한 새 성적 또는 새 독립 검증이라고 부르지 않습니다. 최종 Pages/브라우저 검증은 아직 미실행이며 PR 생성 도구 시간 초과가 배포를 막고 있습니다.
