# 공개 링크 Not Found 수정 패치

## 문제
대시보드에는 캠페인이 `공개`로 표시되지만 `/guide/{token}` 접속 시 `ガイドが見つかりません`이 표시되는 문제가 있었다.

## 원인
공개 페이지는 `publicGuides/{shareToken}` 문서만 읽는다. 그런데 기존 데이터 중 일부는 `campaigns`와 `campaignTabs`만 공개 상태이고, `publicGuides/{shareToken}` 문서가 없거나 `status`가 `published`로 동기화되어 있지 않았다. 공유 버튼은 단순 링크 열기만 수행해서 공개 문서를 새로 만들지 못했다.

## 수정
- 공유 링크 버튼 클릭 시 먼저 `campaignTabs`, `guideSections`, `guideItems` 데이터를 모아 `publicGuides/{shareToken}` 문서를 생성/갱신한다.
- 캠페인 상태를 공개로 변경할 때도 `publicGuides` 문서를 전체 동기화한다.
- 공개 상태가 아닌 캠페인은 공유 링크를 열지 않고 안내 메시지를 표시한다.
- `/admin/campaigns` 전체 목록 페이지의 공유 버튼도 동일하게 동기화 후 새 창을 열도록 수정했다.

## 적용 파일
- `components/admin/AdminDashboard.tsx`
- `components/admin/CampaignListPage.tsx`

## 사용 방법
1. 패치 적용 후 Vercel 재배포
2. `/admin` 또는 `/admin/campaigns`에서 문제가 있던 캠페인의 공유 버튼 `↗` 클릭
3. 버튼 클릭 시 공개 데이터가 자동 동기화되고 `/guide/{token}`이 새 창으로 열린다.
