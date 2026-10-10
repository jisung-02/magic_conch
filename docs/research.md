# 마법의 소라고동: 브라우저 로컬 검색 설계 조사

조사일: 2026-10-10. 공식 문서와 모델 배포 저장소를 기준으로 정리했습니다. 다운로드·속도·한국어 품질의 실제 기기 벤치마크 결과는 아닙니다.

## 결론

첫 버전은 **Transformers.js의 다국어 임베딩 + 사용자가 가져온 JSON/SQLite + 브라우저 코사인 유사도 검색**이 적합합니다. 질문과 가까운 항목을 찾아 저장된 답을 그대로 보여주므로 생성형 LLM은 필수가 아닙니다. 작은 데이터에서는 별도 벡터 DB보다 정확 검색이 구현·배포가 단순합니다. 이 선택은 요구사항에 따른 설계 판단이며, 모든 데이터 크기에서 가장 빠르다는 뜻은 아닙니다.

## ‘laya’는 무엇인가?

이름만으로 확정할 수 없으며, 다음은 서로 다른 제품입니다.

- **Laya / LayaAir**: 철자가 가장 직접적으로 맞는 후보입니다. 공식 소개는 HTML5 웹과 네이티브로 배포하는 2D/3D 렌더링·게임 엔진입니다. WebGL/WebGPU를 지원하므로 소라고동의 3D 표현에는 활용할 수 있지만 임베딩 모델 자체가 아닙니다. 엔진에 AI 제작 도구가 있다는 설명을 언어 모델이라는 뜻으로 해석하면 안 됩니다. 제품 정체의 확신은 높고, 사용자가 이것을 뜻했다는 확신은 낮습니다. [공식 저장소](https://github.com/layabox/LayaAir), [공식 사이트](https://layaair.com/index.html)
- **Llama**: ‘가벼운 언어 모델’이라는 문맥이라면 오타 후보입니다. Meta는 Llama 3.2의 1B·3B 텍스트 모델을 제공합니다. 그러나 ‘laya’가 Llama라는 증거는 없습니다. [Meta 공식 발표](https://ai.meta.com/blog/llama-3-2-connect-2024-vision-edge-mobile-devices)
- **Layla**: 로컬·오프라인 AI라는 문맥에서는 유사 이름 후보입니다. 공식 가이드는 Android/iOS에서 로컬 LLM 또는 클라우드 모델을 사용하는 앱으로 설명합니다. 웹앱에 넣는 단일 임베딩 모델이나 브라우저 SDK로 확인된 것은 아닙니다. [Layla 공식 가이드](https://help.layla-network.ai/getting-started/)

따라서 첫 버전은 특정 이름을 임의로 교정하지 않고, 확인된 기능 요구인 **서버 추론 없는 한국어 로컬 답변 검색**을 기준으로 진행합니다. 시각 효과와 검색 모델은 분리하여 향후 LayaAir 등의 표현 계층을 교체할 수 있습니다.

## 모델과 실행 방식

권장 패키지는 `@huggingface/transformers`, 모델은 `Xenova/multilingual-e5-small`입니다. 이 저장소는 원본 `intfloat/multilingual-e5-small`을 Transformers.js 호환 ONNX로 제공합니다. 고정할 리비전은 `761b726dd34fb83930e26aab4e9ac3899aa1fa78`입니다. [모델 사용법](https://huggingface.co/Xenova/multilingual-e5-small), [리비전](https://huggingface.co/Xenova/multilingual-e5-small/commit/761b726dd34fb83930e26aab4e9ac3899aa1fa78)

- `feature-extraction`, `dtype: q8`, `device: wasm`
- mean pooling, L2 정규화, 384차원
- 질문은 `query: `, 검색 대상 문서는 `passage: ` 접두사 사용. 한국어에도 영문 접두사를 붙입니다.
- 원본 모델은 100개 언어를 지원하는 다국어 모델이며, 언어·데이터에 따라 품질이 달라집니다. 실제 한국어 질문 모음으로 검색 순위를 평가해야 합니다. [원본 모델 설명](https://huggingface.co/intfloat/multilingual-e5-small/raw/main/README.md)

Transformers.js는 브라우저에서 WASM CPU 실행을 기본으로 제공하며 WebGPU도 선택할 수 있습니다. 호환성이 중요한 첫 버전은 WASM을 기준으로 하고, GPU는 기기별 검증 후 가속 옵션으로 추가합니다. [실행 방식](https://huggingface.co/docs/transformers.js/index)

### 최초 다운로드와 메모리

- q8 ONNX 가중치: 약 **118 MB**
- `tokenizer.json`: 약 **17.1 MB**
- 둘의 합만 약 **135 MB**이며, 앱·설정·ONNX 실행 런타임·필요한 WASM 자산이 추가됩니다.
- 따라서 전체 최초 다운로드는 **약 135 MB + 런타임/앱 자산**으로 안내해야 합니다. 실제 전체 전송량은 고정된 빌드의 네트워크 로그로 측정해야 하며 여기서는 측정하지 않았습니다.
- 같은 저장소의 q4 파일은 약 399 MB라서 이름만 보고 q8보다 작다고 선택하면 안 됩니다. 저장소 전체 용량도 한 번의 모델 다운로드 크기가 아닙니다. [가중치 파일](https://huggingface.co/Xenova/multilingual-e5-small/tree/main/onnx), [토크나이저 파일](https://huggingface.co/Xenova/multilingual-e5-small/tree/main)

대안인 `Xenova/paraphrase-multilingual-MiniLM-L12-v2`도 q8가 약 118 MB여서 다운로드 절감 근거는 없습니다. E5는 검색 중심의 기본 선택이며, 존재하는 모든 모델 중 절대 최소라는 주장은 아닙니다. [대안 파일 목록](https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2/tree/main/onnx)

## DB 선택과 가져오기

### 첫 버전: JSON / 일반 SQLite + JavaScript 검색

JSON은 외부 DB 엔진 없이 읽을 수 있습니다. SQLite는 일반 테이블에서 벡터를 읽고 JavaScript에서 코사인 검색하면 `sqlite-vec` 없이도 됩니다. 파일 입력은 명시된 앱 스키마만 허용하며 임의의 `.db`를 모두 지원한다고 안내하지 않습니다.

권장 논리 스키마는 모델 메타데이터와 `id`, `text`, `answer`, `embedding` 레코드입니다. JSON은 숫자 배열을, SQLite는 float32 BLOB을 사용할 수 있습니다. 이 문서는 설계 제안이며 실제 지원 필드명은 프로젝트 README와 예제 파일이 기준입니다.

메타데이터에는 버전, 정확한 모델 ID/리비전, 차원, pooling, 정규화, query/document 접두사, 벡터 인코딩을 기록합니다. 서로 다른 모델은 차원이 같아도 호환되지 않습니다. 가져올 때 유한한 숫자, 길이, 고유 ID, 모델 메타데이터를 검사하고 불일치하면 거부하거나 원문에서 다시 임베딩해야 합니다. 384차원 float32 벡터의 순수 크기는 항목당 1,536바이트입니다.

### SQLite WASM + sqlite-vec

벡터 검색을 SQL 내부에 둘 수 있지만, 공식 브라우저 문서는 확장을 WASM에 **정적으로 컴파일**해야 한다고 설명합니다. Node용 확장 로딩 방법을 그대로 브라우저에 적용할 수 없습니다. 공식 `sqlite-vec-wasm-demo` 패키지도 안정된 제품 배포용 API가 아닌 데모이며 임의로 바뀔 수 있다고 안내합니다. 첫 버전에서는 이 추가 빌드 부담을 피합니다. [공식 브라우저 문서](https://alexgarcia.xyz/sqlite-vec/wasm.html)

### PGlite + pgvector

Postgres/pgvector SQL 호환성이 중요하면 좋은 대안입니다. PGlite는 브라우저에서 실행되며 코어를 gzip 기준 3 MB 미만으로 소개합니다. 이는 모델 다운로드나 전체 앱 크기가 아닙니다. [PGlite 소개](https://pglite.dev/docs/about)

`loadDataDir`는 PGlite의 `dumpDataDir()`로 만든 tarball을 받습니다. 임의의 SQLite 파일을 넣는 기능이 아닙니다. CSV 등의 데이터는 Blob과 COPY 경로로 가져올 수 있습니다. [가져오기 API](https://pglite.dev/docs/api)

브라우저 저장은 현재 공식 문서가 IndexedDB를 권장합니다. 해당 OPFS AHP 구현은 Safari에서 지원되지 않는다고 명시되어 있습니다. [파일시스템 지원](https://pglite.dev/docs/filesystems)

## 생성형 답변이 필요해질 때

WebLLM은 브라우저 WebGPU 기반 LLM 실행 엔진입니다. 공식 사용 시작 문서가 WebGPU 호환 브라우저를 요구하므로 WASM 검색보다 기기 조건이 까다롭습니다. [WebLLM 요구사항](https://webllm.mlc.ai/docs/user/get_started.html)

작은 후보는 `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`입니다. 공식 WebLLM 설정에 등록되어 있고, 가중치 shard 합계는 약 278 MB, 모델 저장소는 약 290 MB입니다. 런타임과 컴파일된 모델 라이브러리가 추가됩니다. 공식 설정의 4,096 토큰 문맥 기준 VRAM 추정은 약 944.62 MB로, 다운로드 크기와 실행 메모리는 다릅니다. [WebLLM 공식 설정](https://raw.githubusercontent.com/mlc-ai/web-llm/main/src/config.ts), [MLC 파일 목록](https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/tree/main)

원본 Qwen 모델은 한국어를 지원 언어로 명시하지만 이 작은 모델의 실제 답변 품질을 보증하지는 않습니다. 저장된 답을 선택하기만 한다면 도입하지 않는 편이 단순합니다. [Qwen 공식 모델 카드](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct?chat_template=default)

Transformers.js에도 `onnx-community/Qwen2.5-0.5B-Instruct` q4 예제가 있지만 해당 q4 ONNX 파일은 약 786 MB입니다. MLC의 다운로드 크기를 ONNX 버전에 적용하면 안 됩니다. [Transformers.js 예제](https://huggingface.co/docs/transformers.js/guides/dtypes), [ONNX 파일](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct/tree/main/onnx)

## 제품에서 반드시 구분할 것

1. **브라우저 로컬 추론과 최초 오프라인 실행은 다릅니다.** 모델·런타임·앱 자산을 처음 받을 때 네트워크가 필요합니다. 완전 오프라인은 모든 자산을 미리 저장하고 재실행을 검증한 뒤에만 보장할 수 있습니다.
2. 사용자 질문과 가져온 파일을 서버로 보내지 않는 설계와 모델 자산을 외부 호스트에서 다운로드하는 동작을 별도로 설명합니다. 후자의 접속 정보는 해당 호스트에 전달됩니다.
3. 브라우저 캐시는 지워질 수 있으므로 영구 보관을 약속하지 않습니다. 원본 파일과 내보내기 기능이 안전망입니다.
4. 키워드 검색은 의미 임베딩 검색과 다릅니다. 모델을 아직 받지 않았거나 실패했을 때 사용하는 대안은 화면에서 분명히 표시합니다.
5. 유사도 점수는 정답 확률이 아닙니다. 부정 표현과 모호한 한국어 질문, 낮은 관련성의 질문을 포함해 테스트하고 근거 없는 확신 대신 저장된 답의 출처를 표시합니다.
