# 다음 작업 순서

## 1. GitHub 업로드
1. GitHub에서 새 Repository 생성
2. 이 ZIP 압축 해제
3. 압축 해제된 폴더 안의 모든 파일을 Repository에 업로드
4. Commit

## 2. Vercel 연결
1. Vercel 접속
2. Add New Project
3. GitHub Repository 선택
4. Framework Preset: Next.js
5. Deploy

## 3. Supabase 생성
1. Supabase 프로젝트 생성
2. SQL Editor 열기
3. `supabase/schema.sql` 전체 복사 후 실행
4. Storage에서 `guide-assets` bucket 생성

## 4. 환경변수 설정
Vercel Project Settings → Environment Variables에 `.env.example` 값을 채웁니다.

## 5. 다음 개발 단계
- Supabase 실제 DB 데이터 연결
- Google OAuth 로그인 연결
- 관리자 허용 이메일 검증
- 엑셀 업로드 → GPT 생성 → DB 저장 플로우 연결
- 미디어 업로드 연결
