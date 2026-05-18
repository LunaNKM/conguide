# Public Guide isDeleted Type Fix

## 수정 내용

`GuideItem` 타입에는 `isDeleted` 필드가 없기 때문에 공개 가이드 fallback 로딩 시 `item.isDeleted`로 필터링하면 TypeScript 빌드가 실패했습니다.

이번 수정에서는 Firestore 원본 데이터에서 `isDeleted` 값을 먼저 확인한 뒤, 삭제된 항목은 `GuideItem` 객체로 변환하지 않도록 변경했습니다.

- 삭제 항목: `null` 반환
- 정상 항목: `GuideItem` 타입에 맞는 필드만 반환
- 이후 type guard로 `GuideItem[]`만 유지

## 수정 파일

- `components/guide/PublicGuideClient.tsx`
