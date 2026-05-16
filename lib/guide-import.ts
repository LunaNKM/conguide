import type { GuideItem, GuideSection, GuideTab, SectionType } from "@/types/guide";
import { FIXED_SHOOTING_NOTICE_JA } from "@/lib/constants";

export interface ParsedOrientSheet {
  sheetName: string;
  rows: string[][];
  fields: Record<string, string>;
  appealPoints: Array<{ titleKo: string; bodyKo: string }>;
  hashtags: string[];
  rawText: string;
}

export interface GeneratedGuidePayload {
  brandName?: string;
  productName?: string;
  skuName?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  hashtags?: string[];
  sections?: GuideSection[];
}

const FIELD_PATTERNS: Array<[string, RegExp]> = [
  ["brandName", /브랜드\s*(이름|명)|광고주|브랜드명/i],
  ["companyName", /회사명|제조사|판매사/i],
  ["productName", /상품명|제품명|PR\s*상품/i],
  ["productUrl", /상품\s*URL|제품\s*URL|URL/i],
  ["releaseDate", /발매일|출시일|런칭일/i],
  ["price", /가격|정가|판매가/i],
  ["target", /타겟|타깃|대상/i],
  ["purpose", /시행\s*목적|진행\s*목적|캠페인\s*목적/i],
  ["providedItems", /제공\s*품목|제공품|제공\s*상품/i],
  ["deliveryMethod", /배송\s*방식|제공품\s*배송/i],
  ["usage", /사용\s*방법|사용법|사용\s*절차/i],
  ["features", /특징|장점|상품의\s*특장점|PR\s*상품의\s*특징/i],
  ["hashtags", /필수\s*해시태그|해시태그/i],
  ["postingNotice", /투고\s*시\s*주의|게시\s*시\s*주의|업로드\s*주의/i],
  ["ngWords", /NG|금지|주의\s*문언|약기법/i]
];

function normalizeCell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/\r\n/g, "\n").trim();
}

function compactLine(parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join(" ");
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "_")}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function extractNextValue(row: string[], labelIndex: number): string {
  const right = row.slice(labelIndex + 1).map((item) => item.trim()).filter(Boolean);
  if (right.length) return right.join("\n");
  return "";
}

function collectFields(rows: string[][]): Record<string, string> {
  const fields: Record<string, string> = {};

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    for (let cellIndex = 0; cellIndex < row.length; cellIndex += 1) {
      const cell = row[cellIndex];
      if (!cell) continue;
      for (const [fieldName, pattern] of FIELD_PATTERNS) {
        if (!pattern.test(cell)) continue;
        const currentValue = extractNextValue(row, cellIndex) || compactLine((rows[rowIndex + 1] ?? []).slice(cellIndex));
        if (currentValue && !fields[fieldName]) fields[fieldName] = currentValue;
      }
    }
  }

  return fields;
}

function collectAppealPoints(rows: string[][]): Array<{ titleKo: string; bodyKo: string }> {
  const appealRows: Array<{ titleKo: string; bodyKo: string }> = [];
  const seen = new Set<string>();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const joined = compactLine(row);
    if (!joined) continue;

    const appealMatch = joined.match(/소구\s*포인트\s*[①②③④⑤1-5]?|訴求\s*ポイント\s*[①②③④⑤1-5]?/i);
    if (!appealMatch) continue;

    const labelIndex = row.findIndex((cell) => /소구\s*포인트|訴求\s*ポイント/i.test(cell));
    const directValue = labelIndex >= 0 ? extractNextValue(row, labelIndex) : "";
    const nextLine = compactLine((rows[rowIndex + 1] ?? []).filter(Boolean));
    const bodyKo = directValue || nextLine || joined.replace(appealMatch[0], "").trim();
    if (!bodyKo || seen.has(bodyKo)) continue;
    seen.add(bodyKo);
    appealRows.push({ titleKo: `소구 포인트 ${appealRows.length + 1}`, bodyKo });
    if (appealRows.length >= 5) break;
  }

  return appealRows;
}

function collectHashtags(value: string): string[] {
  const matches = value.match(/#[^\s,，、#]+/g) ?? [];
  if (matches.length) return Array.from(new Set(matches));
  return value
    .split(/[\s,，、]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith("#") ? item : `#${item}`));
}

export async function parseOrientSheetFile(file: File): Promise<ParsedOrientSheet> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.find((name) => name.startsWith("KOR_"))
    ?? workbook.SheetNames.find((name) => !/안내|JPN_/i.test(name))
    ?? workbook.SheetNames[0];

  if (!sheetName) throw new Error("엑셀 파일에서 읽을 수 있는 시트를 찾지 못했습니다.");

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false });
  const rows = rawRows
    .map((row) => row.map(normalizeCell))
    .filter((row) => row.some(Boolean));

  const fields = collectFields(rows);
  const appealPoints = collectAppealPoints(rows);
  const hashtags = fields.hashtags ? collectHashtags(fields.hashtags) : [];
  const rawText = rows.map((row) => compactLine(row)).filter(Boolean).join("\n");

  return { sheetName, rows, fields, appealPoints, hashtags, rawText };
}

export function mergeGeneratedGuide(current: GuideTab, generated: GeneratedGuidePayload): GuideTab {
  const clone: GuideTab = JSON.parse(JSON.stringify(current));
  if (generated.brandName) clone.brandName = generated.brandName;
  if (generated.productName) clone.productName = generated.productName;
  if (generated.skuName) clone.skuName = generated.skuName;
  if (generated.heroTitle) clone.heroTitle = generated.heroTitle;
  if (generated.heroSubtitle) clone.heroSubtitle = generated.heroSubtitle;
  if (Array.isArray(generated.hashtags)) clone.hashtags = generated.hashtags;

  const generatedSections = Array.isArray(generated.sections) ? generated.sections : [];
  for (const nextSection of generatedSections) {
    const sectionType = nextSection.sectionType as SectionType;
    const existingIndex = clone.sections.findIndex((section) => section.sectionType === sectionType);
    const normalized: GuideSection = {
      id: existingIndex >= 0 ? clone.sections[existingIndex].id : makeId("section"),
      sectionType,
      titleJa: nextSection.titleJa,
      sortOrder: nextSection.sortOrder,
      isCollapsible: nextSection.isCollapsible,
      items: (nextSection.items ?? []).map((item, index) => ({
        id: item.id || makeId("item"),
        titleKo: item.titleKo ?? "",
        bodyKo: item.bodyKo ?? "",
        titleJa: item.titleJa || "項目",
        bodyJa: item.bodyJa || "",
        itemType: item.itemType,
        sortOrder: item.sortOrder || index + 1,
        media: item.media ?? []
      }))
    };
    if (existingIndex >= 0) clone.sections[existingIndex] = normalized;
    else clone.sections.push(normalized);
  }

  const notice = clone.sections.find((section) => section.sectionType === "notice");
  if (notice) {
    const shooting = notice.items.find((item) => item.titleJa.includes("撮影") || item.id.includes("notice_shooting"));
    if (shooting) shooting.bodyJa = FIXED_SHOOTING_NOTICE_JA;
    else notice.items.unshift({
      id: makeId("notice_shooting"),
      titleKo: "촬영 시 주의사항",
      bodyKo: "고정 촬영 주의사항",
      titleJa: "撮影時の注意事項",
      bodyJa: FIXED_SHOOTING_NOTICE_JA,
      itemType: "notice",
      sortOrder: 1,
      media: []
    });
  }

  clone.sections = clone.sections.map((section, sectionIndex) => ({
    ...section,
    sortOrder: sectionIndex + 1,
    items: section.items.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex + 1 }))
  }));

  return clone;
}
