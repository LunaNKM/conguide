# Multi KOR Sheets Patch

## 적용 내용

- XLSX 안에 `KOR_`로 시작하는 시트가 2개 이상 있을 경우, 모든 KOR 시트를 감지합니다.
- 각 KOR 시트마다 GPT 초안을 생성합니다.
- 한 캠페인 안에 KOR 시트 개수만큼 SKU 세부탭과 공유 링크를 생성합니다.
- 캠페인 목록에서 생성된 SKU 세부탭들을 칩 형태로 확인하고, 각 SKU 편집 화면으로 바로 이동할 수 있습니다.
- 캠페인 상태를 공개/미공개로 변경할 때 해당 캠페인의 모든 SKU 세부탭 상태도 함께 갱신됩니다.

## 예시

엑셀 파일 안에 아래 시트가 있으면:

- KOR_상품A
- KOR_상품B
- KOR_상품C

저장 결과:

- 캠페인 1개
- SKU 세부탭 3개
- 공유 링크 3개

## 적용 파일

- `lib/guide-import.ts`
- `components/admin/AdminDashboard.tsx`
- `components/admin/CampaignListPage.tsx`
- `app/globals.css`
