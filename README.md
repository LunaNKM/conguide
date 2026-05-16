# G-Futures Influencer Guide System - Firebase Edition

오리엔시트 XLSX를 기반으로 일본 인플루언서용 모바일 가이드 페이지를 생성·관리하는 Next.js 프로젝트입니다.

## 구조

- GitHub: 코드 저장소
- Vercel: Next.js 배포 / API Route 실행
- Firebase: Google 로그인 / Firestore DB / Storage
- OpenAI: GPT-5.4 기반 일본어 정리·번역

## 주요 페이지

- `/admin` : 내부 관리자 페이지. Firebase 환경변수 설정 전에는 데모 모드로 표시됩니다.
- `/guide/guide-easydew-ointgel-jp` : 샘플 인플루언서 가이드 페이지.
- `/api/firebase/seed?secret=...&admin=...` : Firebase 초기 샘플 데이터 생성용 API.

## 환경변수

`.env.example`에 있는 값을 Vercel Settings → Environment Variables에 추가하세요.

## Firebase 데이터 구조

```text
allowedAdmins/{email}
campaigns/{campaignId}
campaignTabs/{tabId}
  sections/{sectionId}
    items/{itemId}
      media/{mediaId}
glossaryGlobal/{id}
systemTemplates/{id}
```

## 현재 단계

이 ZIP은 Supabase를 제거하고 Firebase로 전환한 스타터입니다.
UI는 샘플 데이터로 동작하며, Firebase 환경변수를 넣으면 관리자 Google 로그인과 Firestore 샘플 데이터 조회를 붙일 수 있는 구조입니다.
