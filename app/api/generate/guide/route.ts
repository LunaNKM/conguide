import { NextResponse } from "next/server";
import OpenAI from "openai";
import { FIXED_SHOOTING_NOTICE_JA } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ParsedOrientSheetPayload {
  sheetName?: string;
  fields?: Record<string, string>;
  appealPoints?: Array<{ titleKo: string; bodyKo: string }>;
  hashtags?: string[];
  rawText?: string;
}

interface GlossaryEntry {
  korean: string;
  japanese: string;
  category?: string;
}

function splitHashtags(value: string): string[] {
  return value
    .split(/[\s,，、]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith("#") ? item : `#${item}`));
}

function fallbackGuide(parsed: ParsedOrientSheetPayload) {
  const fields = parsed.fields ?? {};
  const productName = fields.productName || parsed.sheetName?.replace(/^KOR_/, "") || "商品名未設定";
  const brandName = fields.brandName || "ブランド名未設定";
  const hashtags = parsed.hashtags?.length ? parsed.hashtags : splitHashtags(fields.hashtags ?? "");
  const appeals = (parsed.appealPoints ?? []).slice(0, 5);

  return {
    brandName,
    productName,
    skuName: productName,
    heroTitle: brandName,
    heroSubtitle: productName,
    hashtags,
    sections: [
      {
        id: "section_basic_generated",
        sectionType: "basic",
        titleJa: "基本情報",
        sortOrder: 1,
        isCollapsible: false,
        items: [
          { id: "basic_brand", titleKo: "브랜드 정보", bodyKo: fields.brandName || "", titleJa: "ブランド情報", bodyJa: [brandName, fields.companyName, fields.target].filter(Boolean).join("\n"), itemType: "text", sortOrder: 1, media: [] },
          { id: "basic_product", titleKo: "제품 정보", bodyKo: fields.productName || "", titleJa: "製品情報", bodyJa: [productName, fields.providedItems, fields.usage].filter(Boolean).join("\n"), itemType: "text", sortOrder: 2, media: [] }
        ]
      },
      {
        id: "section_product_generated",
        sectionType: "product",
        titleJa: "商品紹介および訴求ポイント",
        sortOrder: 2,
        isCollapsible: true,
        items: [
          { id: "product_features", titleKo: "제품 특징", bodyKo: fields.features || "", titleJa: "商品の特長", bodyJa: fields.features || "オリジナルシートの内容を確認し、必要に応じて編集してください。", itemType: "text", sortOrder: 1, media: [] },
          ...appeals.map((point, index) => ({
            id: `appeal_${index + 1}`,
            titleKo: point.titleKo,
            bodyKo: point.bodyKo,
            titleJa: `訴求ポイント ${index + 1}`,
            bodyJa: point.bodyKo,
            itemType: "appeal" as const,
            sortOrder: index + 2,
            media: []
          }))
        ]
      },
      {
        id: "section_content_generated",
        sectionType: "content",
        titleJa: "コンテンツの必須事項",
        sortOrder: 3,
        isCollapsible: true,
        items: []
      },
      {
        id: "section_notice_generated",
        sectionType: "notice",
        titleJa: "注意事項",
        sortOrder: 4,
        isCollapsible: true,
        items: [
          { id: "notice_shooting", titleKo: "촬영 시 주의사항", bodyKo: "고정 촬영 주의사항", titleJa: "撮影時の注意事項", bodyJa: FIXED_SHOOTING_NOTICE_JA, itemType: "notice", sortOrder: 1, media: [] },
          { id: "notice_posting", titleKo: "투고 시 주의사항", bodyKo: fields.postingNotice || "", titleJa: "投稿時の注意事項", bodyJa: fields.postingNotice || "投稿時の注意事項を管理画面で入力してください。", itemType: "notice", sortOrder: 2, media: [] },
          { id: "notice_ng", titleKo: "NG 문언", bodyKo: fields.ngWords || "", titleJa: "NG表現・注意事項", bodyJa: fields.ngWords || "薬機法に抵触しないよう、表現にはご注意ください。", itemType: "notice", sortOrder: 3, media: [] }
        ]
      }
    ]
  };
}

function stripCodeFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { parsed?: ParsedOrientSheetPayload; glossary?: GlossaryEntry[] };
    const parsed = body.parsed ?? {};
    const glossary = body.glossary ?? [];

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: true, mode: "fallback", guide: fallbackGuide(parsed), warning: "OPENAI_API_KEY가 없어 임시 정리 결과를 반환했습니다." });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-5.4";

    const prompt = `
당신은 한국어 뷰티/마케팅 오리엔시트를 일본 인플루언서용 가이드로 정리하는 전문가입니다.

규칙:
- 한국어 원문의 뉘앙스를 해치지 않는 선에서 자연스러운 일본어로 정리합니다.
- 원문에 없는 사실, 수치, 효능, 임상 근거는 새로 만들지 않습니다.
- 소구 포인트는 최대 5개, 각 항목은 제목과 설명만 만듭니다.
- 소구 포인트를 요약하지 말고 보기 좋게 정리합니다.
- コンテンツの必須事項은 관리자가 직접 작성하므로 빈 배열로 둡니다.
- 撮影時の注意事項은 반드시 제공된 고정 문구를 사용합니다.
- 약기법 표현을 임의로 순화하지 말고, 원문 기반으로 정리합니다.
- URL, 해시태그, 브랜드 영문명, 숫자는 임의 변경하지 않습니다.

고정 촬영 주의사항 일본어:
${FIXED_SHOOTING_NOTICE_JA}

용어집 JSON:
${JSON.stringify(glossary, null, 2)}

입력 데이터 JSON:
${JSON.stringify(parsed, null, 2)}

아래 JSON 스키마로만 답하세요. 설명 문장 금지.
{
  "brandName": "",
  "productName": "",
  "skuName": "",
  "heroTitle": "",
  "heroSubtitle": "",
  "hashtags": ["#PR"],
  "sections": [
    {
      "id": "section_basic_generated",
      "sectionType": "basic",
      "titleJa": "基本情報",
      "sortOrder": 1,
      "isCollapsible": false,
      "items": []
    },
    {
      "id": "section_product_generated",
      "sectionType": "product",
      "titleJa": "商品紹介および訴求ポイント",
      "sortOrder": 2,
      "isCollapsible": true,
      "items": []
    },
    {
      "id": "section_content_generated",
      "sectionType": "content",
      "titleJa": "コンテンツの必須事項",
      "sortOrder": 3,
      "isCollapsible": true,
      "items": []
    },
    {
      "id": "section_notice_generated",
      "sectionType": "notice",
      "titleJa": "注意事項",
      "sortOrder": 4,
      "isCollapsible": true,
      "items": []
    }
  ]
}
items의 각 원소는 {"id":"","titleKo":"","bodyKo":"","titleJa":"","bodyJa":"","itemType":"text|appeal|scene|notice|hashtag|link","sortOrder":1,"media":[]} 형식입니다.
`;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "Return strict JSON only. No markdown." },
        { role: "user", content: prompt }
      ]
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const guide = JSON.parse(stripCodeFence(content));
    return NextResponse.json({ ok: true, mode: "openai", guide });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가이드 생성 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
