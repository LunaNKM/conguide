import * as XLSX from "xlsx";

export interface ParsedOrientSheet {
  sheetName: string;
  rows: Record<string, unknown>[];
  rawText: string;
}

export function parseOrientSheet(buffer: ArrayBuffer): ParsedOrientSheet {
  const workbook = XLSX.read(buffer, { type: "array" });
  const korSheetName = workbook.SheetNames.find((name) => name.startsWith("KOR_"));

  if (!korSheetName) {
    throw new Error("KOR_ 로 시작하는 시트를 찾을 수 없습니다.");
  }

  const sheet = workbook.Sheets[korSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const rawRows = XLSX.utils.sheet_to_json<Array<string | number | boolean>>(sheet, { header: 1, defval: "" });
  const rawText = rawRows
    .map((row) => row.filter(Boolean).join("\t"))
    .filter(Boolean)
    .join("\n");

  return { sheetName: korSheetName, rows, rawText };
}
