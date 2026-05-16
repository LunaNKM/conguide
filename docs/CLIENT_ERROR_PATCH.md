# Client-side Exception Patch

이 패치는 Firebase 설정 오류나 빈 가이드 데이터 때문에 브라우저 전체가 죽지 않도록 방어 코드를 추가합니다.

수정 파일:
- lib/firebase/client.ts
- components/admin/AuthGate.tsx
- components/guide/GuidePage.tsx

적용 후에도 오류가 남으면 브라우저 개발자도구 Console의 빨간 에러 메시지를 확인해야 합니다.
