# Excel-first campaign creation and Korean-to-Japanese auto-translation patch

## 변경 사항

1. `/admin`의 `새 캠페인` 모달에서 XLSX 파일 선택 input을 명확히 표시합니다.
2. XLSX 파일을 선택하면 KOR_ 시트를 파싱한 뒤 GPT 초안을 자동 생성합니다.
3. 기존 `GPT 초안 생성` 버튼은 `GPT 초안 다시 생성` 용도로 남겨두었습니다.
4. `/admin/tabs/[token]/edit` 편집 화면에서 한국어 제목/본문을 입력한 뒤 입력창 밖으로 포커스를 이동하면 일본어 표시문이 자동 번역됩니다.
5. 자동 번역 API `/api/translate/field`를 추가했습니다.

## 환경변수

자동 번역과 GPT 초안 생성을 실제로 사용하려면 Vercel에 아래 값이 필요합니다.

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4
```

`OPENAI_API_KEY`가 없으면 원문을 임시로 그대로 반환합니다.
