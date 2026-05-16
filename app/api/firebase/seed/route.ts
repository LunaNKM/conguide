import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Firebase Admin SDK 기반 seed API는 현재 사용하지 않습니다.
 *
 * 이 프로젝트는 서비스 계정 키 없이 Firebase Client SDK 중심으로 동작합니다.
 * 샘플 데이터/공개 가이드 데이터 생성은 관리자 페이지에서 로그인한 사용자의
 * Firestore 권한으로 직접 처리합니다.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      message:
        "Firebase Admin seed API is disabled. Use the admin dashboard to create sample data.",
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      message:
        "Firebase Admin seed API is disabled. Use the admin dashboard to create sample data.",
    },
    { status: 410 }
  );
}
