# 다음 단계 - Firebase 전환 버전

## 1. GitHub 업로드

이 ZIP 안의 파일을 GitHub 저장소 최상단에 업로드하세요.
GitHub 첫 화면에서 `package.json`, `app`, `components`, `lib` 폴더가 바로 보여야 합니다.

## 2. Vercel 재배포

GitHub에 업로드하면 Vercel이 자동 배포합니다.
배포가 성공하면 아래 페이지를 확인하세요.

```text
/admin
/guide/guide-easydew-ointgel-jp
```

## 3. Firebase 프로젝트 생성

Firebase Console에서 새 프로젝트를 만들고 아래 기능을 켭니다.

1. Authentication → Sign-in method → Google 활성화
2. Firestore Database 생성
3. Storage 생성
4. Project Settings → Web App 추가
5. Service Account key 생성

## 4. Vercel 환경변수 입력

Firebase Web App 설정에서 아래 값을 가져와 Vercel에 넣습니다.

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

Firebase Service Account JSON에서 아래 값을 가져와 Vercel에 넣습니다.

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

`FIREBASE_PRIVATE_KEY`는 줄바꿈이 있는 긴 값입니다. Vercel에는 JSON의 값을 그대로 붙여넣어도 됩니다.
오류가 나면 `\n` 형태로 바꿔 넣으면 됩니다.

그리고 직접 임의 비밀번호를 하나 정해서 넣습니다.

```text
FIREBASE_SEED_SECRET
```

예:

```text
gfutures-seed-2026
```

## 5. 샘플 데이터 생성

Vercel 재배포 후 아래 주소로 접속합니다.

```text
https://내-vercel주소.vercel.app/api/firebase/seed?secret=FIREBASE_SEED_SECRET값&admin=내구글이메일
```

성공하면 JSON으로 `ok: true`가 표시됩니다.
이 작업은 다음 데이터를 만듭니다.

- allowedAdmins에 내 이메일 추가
- Easydew 샘플 캠페인 생성
- Easydew 샘플 SKU 세부탭 생성
- 기본 섹션/항목 생성
- 전사 공통 용어집 샘플 생성

## 6. Firestore Rules

Firebase Console → Firestore Database → Rules에 `firebase/firestore.rules` 내용을 붙여넣고 Publish 합니다.

## 7. Storage Rules

Firebase Console → Storage → Rules에 `firebase/storage.rules` 내용을 붙여넣고 Publish 합니다.

## 8. 다음 개발 단계

다음 ZIP에서 구현할 기능:

- 관리자 캠페인 목록 Firestore 실데이터 연결
- 캠페인 생성/수정
- SKU 세부탭 생성/복제
- 가이드 항목 추가/수정/삭제/복구
- 파일 업로드
- XLSX 파싱
- GPT-5.4 가이드 생성
