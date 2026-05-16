import { NextResponse } from "next/server";
import { mockGuideTab } from "@/lib/mock-data";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return NextResponse.json({ ...mockGuideTab, shareToken: token });
}
