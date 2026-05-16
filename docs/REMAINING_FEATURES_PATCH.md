# Remaining Features Patch

이 패치는 다음 기능을 추가합니다.

1. `/admin/tabs/[token]/edit` 편집 화면에서 XLSX 오리엔시트 업로드
2. `KOR_` 시트 자동 탐지 및 주요 항목 파싱
3. `/api/generate/guide`에서 OpenAI GPT 모델을 호출해 일본어 가이드 구조 생성
4. GPT 결과를 편집 화면에 자동 반영
5. 관리자 직접 수정 후 저장 시 `publicGuides/{shareToken}`에 즉시 반영
6. `/admin/glossary` 전사 공통 용어집 관리 화면
7. GPT 생성 시 Firestore의 `glossaryGlobal` 용어집 반영

## Vercel 환경변수

아래 환경변수를 추가해야 실제 GPT가 작동합니다.

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4
```

`OPENAI_API_KEY`가 없으면 임시 정리 결과를 반환하므로 화면 테스트는 가능합니다.

## Firebase Rules

`firebase/firestore.rules`를 Firebase Console > Firestore Database > Rules에 직접 붙여넣고 Publish 해야 합니다.

## 사용 흐름

1. `/admin/glossary`에서 고정 번역 용어 등록
2. `/admin`에서 캠페인 생성
3. 캠페인 행의 편집 버튼 클릭
4. 편집 화면에서 XLSX 선택
5. `GPT 정리 반영` 클릭
6. 결과 검토/수정
7. 저장
8. `/guide/{shareToken}` 확인
