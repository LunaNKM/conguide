import { NextResponse } from "next/server";
import { parseOrientSheet } from "@/lib/excel-parser";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "xlsx 파일이 필요합니다." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseOrientSheet(buffer);

    return NextResponse.json({ ok: true, parsed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "엑셀 파싱 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
