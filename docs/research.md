# 현재 모델 조사

실제 요청의 Laya는 [NandhaKishorM/laya](https://github.com/NandhaKishorM/laya)의 non-autoregressive typed decision model입니다. 기존 E5는 검색용 임베딩 모델이며 Laya로 표시하지 않습니다. Laya Multilingual의 학습된 encoder와 decision head를 함께 사용합니다.

최신 구조, 한국어 모델 비교, 정확한 revision, export/parity, 폐기한 INT8 실험, 다운로드/메모리/속도와 한계는 [품질 보고서](quality-report.md)에 있습니다. 콘텐츠와 임베딩 모델의 공식 출처는 `research/`에 보존합니다. 초기 모델 정체 조사는 `research-initial.md`에 역사적 기록으로 남기며 현재 구현 설명으로 사용하지 않습니다.
