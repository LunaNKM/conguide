# Public Guide Media Type Fix

## 수정 내용

`GuideMedia` 타입에는 `sortOrder` 필드가 없는데 `PublicGuideClient.tsx`에서 해당 필드를 직접 넣고 있어 Vercel 빌드가 실패하던 문제를 수정했습니다.

## 변경 방식

- `GuideMedia` 객체에는 `sortOrder`를 넣지 않음
- Firestore의 `sortOrder` 값은 내부 정렬용 `{ media, order }` 래퍼에서만 사용
- 최종적으로 `GuideItem.media`에는 순수 `GuideMedia[]`만 전달

## 수정 파일

- `components/guide/PublicGuideClient.tsx`
