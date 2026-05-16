import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: false,
    message: "Supabase Storage 연결 후 파일 업로드를 활성화합니다. 현재 ZIP은 UI/구조 1차 버전입니다."
  }, { status: 501 });
}
