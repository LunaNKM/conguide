import { NextResponse } from "next/server";
import { buildGuideGenerationPrompt, GUIDE_GENERATION_SYSTEM_PROMPT } from "@/lib/guide-generator";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const { rawText, glossary = {} } = await request.json();
    if (!rawText) return NextResponse.json({ error: "rawText가 필요합니다." }, { status: 400 });

    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: "system", content: GUIDE_GENERATION_SYSTEM_PROMPT },
        { role: "user", content: buildGuideGenerationPrompt(rawText, glossary) }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    return NextResponse.json({ ok: true, guide: JSON.parse(content) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GPT 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
