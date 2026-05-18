# 공개 가이드 Not Found 종합 수정

## 원인

관리자 화면의 `공개` 상태와 실제 공개 페이지가 읽는 `publicGuides/{token}` 문서가 서로 동기화되지 않으면, `/guide/{token}`에서 `ガイドが見つかりません`가 표시됩니다.

## 수정 방식

공개 페이지가 이제 아래 순서로 데이터를 읽습니다.

1. `publicGuides/{token}` 문서가 있으면 우선 사용
2. 없으면 `campaignTabs`에서 `shareToken`으로 원본 탭을 찾음
3. 연결된 `campaigns`, `guideSections`, `guideItems`, `mediaAssets`를 조합해 즉시 가이드 표시
4. `campaignTabs.status` 또는 `campaigns.status` 중 하나라도 공개 상태면 표시

## 공개로 인정하는 상태값

- `published`
- `public`
- `active`
- `open`
- `공개`

## 적용 필요 사항

`firebase/firestore.rules`는 Firebase Console에서 직접 다시 붙여넣고 Publish 해야 합니다.
