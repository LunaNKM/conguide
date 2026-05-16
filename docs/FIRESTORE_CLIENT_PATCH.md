# Firestore Client Patch

이 패치는 Firebase 서비스 계정 키 없이 동작하도록 관리자/공개 가이드 조회를 Firebase Client SDK 기준으로 바꿉니다.

## 변경 내용

- `/guide/[token]` 페이지가 Firebase Admin SDK 대신 브라우저 Client SDK로 Firestore에서 공개 가이드를 읽습니다.
- 관리자 대시보드에 `샘플 데이터 생성` 버튼을 추가했습니다.
- 샘플 데이터는 `campaigns`, `campaignTabs`, `guideSections`, `guideItems`, `systemTemplates` 컬렉션에 저장됩니다.
- `/guide/guide-easydew-ointgel-jp`에서 Firestore에 저장된 공개 데이터를 읽어 표시합니다.

## 적용 후 확인

1. `/admin` 접속
2. Google 로그인
3. `샘플 데이터 생성` 클릭
4. Firestore Console에서 컬렉션 생성 확인
5. `/guide/guide-easydew-ointgel-jp` 접속
