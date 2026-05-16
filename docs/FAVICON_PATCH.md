# Favicon Patch

이 패치는 업로드된 G 로고를 기반으로 사이트 파비콘 파일을 추가합니다.

## 포함 파일

- public/favicon.ico
- public/favicon-16x16.png
- public/favicon-32x32.png
- public/favicon-192.png
- public/favicon-512.png
- public/apple-touch-icon.png
- app/icon.png

Next.js App Router는 app/icon.png를 자동으로 favicon/metadata에 연결합니다. public/favicon.ico도 함께 제공해 브라우저 호환성을 보강합니다.
