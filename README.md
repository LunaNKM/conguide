# G-Futures Guide System

오리엔시트 XLSX 파일을 기반으로 일본 인플루언서용 모바일 가이드 페이지를 생성하는 Next.js 프로젝트입니다.

## 현재 ZIP 버전의 범위

이 ZIP은 **1차 스타터 프로젝트**입니다.

포함된 것:

- Next.js App Router 프로젝트 구조
- 관리자 대시보드 샘플 화면
- 모바일 가이드 샘플 화면
- SKU 세부탭 단위 공유 URL 구조
- 엑셀 파싱 API 초안
- GPT 생성 API 초안
- Supabase DB 스키마
- Supabase 클라이언트 파일
- Vercel 배포용 기본 설정

아직 실제 연결이 필요한 것:

- Supabase 실제 DB 연동
- Google OAuth 로그인
- Storage 파일 업로드
- 엑셀 업로드 후 DB 저장
- GPT 결과를 실제 guide_items에 저장

## 주요 URL

```text
/                         시작 페이지
/admin                    관리자 대시보드 샘플
/guide/guide-easydew-ointgel-jp   인플루언서 가이드 샘플
/login                    로그인 페이지 자리
```

## 로컬 실행

개발자가 직접 확인할 경우:

```bash
npm install
npm run dev
```

## Vercel 배포

GitHub에 업로드한 뒤 Vercel에서 Repository를 연결하면 됩니다.

## Supabase

`supabase/schema.sql` 파일을 Supabase SQL Editor에서 실행하세요.

## 환경변수

`.env.example`을 참고하세요.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4
NEXT_PUBLIC_SITE_URL=
```
