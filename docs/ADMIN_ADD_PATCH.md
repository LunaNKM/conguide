# 관리자 추가 기능 패치

## 추가 기능
- `/admin` 우상단에 `관리자 추가` 버튼을 추가했습니다.
- 이메일과 표시명을 입력하면 Firestore `allowedAdmins/{email}` 문서가 생성됩니다.
- 기존 관리자가 새 관리자를 추가할 수 있도록 Firestore Rules의 `allowedAdmins` 쓰기 권한을 수정했습니다.

## 적용 후 필수 작업
Firebase Console → Firestore Database → Rules에서 `firebase/firestore.rules` 내용을 다시 Publish해야 합니다.
