# 마법의 소라고둥

한국어 정적 Vite 앱. 서버 없이 JSON/SQLite·IndexedDB 선택지에서 답을 고릅니다. 선택적 모델 다운로드 후 질문과 후보는 브라우저 안에서 계산합니다.

```
npm ci
npm test
npm run build
npm run prepare:laya-assets
```

`/magic_conch/`에 배포합니다. 마지막 명령은 검증된 Laya 모델 Release를 받아 `dist/models/laya/`에 복사합니다. 개발 테스트는 가중치 없이도 가능하며 Laya 로드는 자산 준비 후 동작합니다.

- 원작 짧은 한국어 답100개 + 안내8개, 자연질문88개/의도22개. 책 전문이 아닌 앱용 새 문장입니다.
- 기본 키워드와 기존 E5 q8 개인 DB 검색 유지. JSON/SQLite20MB·2,000행 제한, 384차원 E5 임베딩 계약 유지.
- 한국어 SRoBERTa q8 문장 검색: no prefix, mean+normalize,768차원. 제공 예시의 자연질문을 검색하며 새 벡터는 기존 E5 DB embedding 필드와 섞지 않습니다.
- 실제 Laya Multilingual trained encoder/head 선택적 실험 모드. 명시적인 약681MB 다운로드·진행 상태·캐시·실패·재시도. FP16 저장/FP32 계산은 모든 압축 가중치의 원본 복원을 검증했습니다.
- 개인 가져오기 내용은 자동 교체하지 않습니다. 새 예시를 쓰려면 '기본값 복원'의 확인을 직접 선택하세요.
- 질문을 저장하지 않습니다. 선택지/기존 E5 벡터는 IndexedDB에 저장하고 다운로드 모델은 브라우저 CacheStorage를 사용합니다. SQLite는 sql.js WASM이며 임베딩은 little-endian Float32 BLOB입니다.

[품질 실험과 한계](docs/quality-report.md), [데이터 형식](public/schema-guide.txt), [모델·콘텐츠 조사](research/README.md). Laya는 평가상 한국어 검색보다 더 좋다고 확인되지 않아 기본값으로 강제하지 않습니다. 점수와 출력은 개인의 중요한 결정이나 사실의 정답을 보장하지 않습니다.
