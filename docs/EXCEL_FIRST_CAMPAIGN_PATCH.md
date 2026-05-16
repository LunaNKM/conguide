# Excel-first campaign creation patch

## Changes

- The `새 캠페인` button now opens an XLSX upload-first modal.
- The modal reads the `KOR_` sheet, sends parsed data to `/api/generate/guide`, creates a draft guide, and saves it to Firestore.
- The old manual campaign creation fields were removed from the main flow.
- Inactive sidebar items were removed. The remaining navigation items now either link to an active route or page anchor:
  - 대시보드 → `/admin`
  - 캠페인 목록 → `#campaign-table`
  - 전사 공통 용어집 → `/admin/glossary`
- New campaign creation still allows minimal campaign name, brand color, and status adjustment.

## Test

1. Go to `/admin`.
2. Click `새 캠페인`.
3. Upload an orient sheet XLSX.
4. Click `GPT 초안 생성`.
5. Click `캠페인 저장`.
6. Open the generated `/guide/{token}` link.
7. Click `✎` in the campaign row to fine-tune the generated draft.
