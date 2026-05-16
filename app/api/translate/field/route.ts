import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TranslatePayload {
  text?: string;
  field?: "titleKo" | "bodyKo" | string;
  context?: {
    sectionType?: string;
    brandName?: string;
    productName?: string;
  };
}

function clean(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TranslatePayload;
    const text = String(body.text ?? "").trim();

    if (!text) {
      return NextResponse.json({ ok: true, mode: "empty", translated: "" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        ok: true,
        mode: "fallback",
        translated: text,
        warning: "OPENAI_API_KEY가 없어 원문을 그대로 반환했습니다."
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-5.4";
    const isTitle = body.field === "titleKo";

    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "당신은 한국어 뷰티/마케팅 오리엔시트를 일본 인플루언서용 자연스러운 일본어로 번역하는 전문가입니다. 원문에 없는 사실, 수치, 효능, 임상 근거는 추가하지 마세요. 약기법 리스크가 있는 표현도 임의로 순화하지 말고 원문 의미를 유지하세요. 출력은 번역문만 반환하세요."
        },
        {
          role: "user",
          content: [
            `번역 대상: ${isTitle ? "제목" : "본문"}`,
            `섹션: ${body.context?.sectionType ?? "unknown"}`,
            `브랜드: ${body.context?.brandName ?? ""}`,
            `상품명: ${body.context?.productName ?? ""}`,
            "",
            "한국어 원문:",
            text,
            "",
            "일본어 번역문만 출력하세요."
          ].join("\n")
        }
      ]
    });

    const translated = clean(completion.choices[0]?.message?.content ?? text);
    return NextResponse.json({ ok: true, mode: "openai", translated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "자동 번역 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
