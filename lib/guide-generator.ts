import { FIXED_SHOOTING_NOTICE_KO } from "@/lib/constants";

export const GUIDE_GENERATION_SYSTEM_PROMPT = `당신은 한국 뷰티/인플루언서 오리엔시트를 일본 인플루언서용 가이드로 정리하는 전문가입니다.
원문의 뉘앙스를 해치지 않는 선에서 자연스러운 일본어로 정리하세요.
원문에 없는 정보를 사실처럼 추가하지 마세요.
부족한 부분은 "추천 문구"로만 제안할 수 있습니다.
약기법 리스크 표현을 임의로 순화하지 말고 원문 취지를 유지하세요.
응답은 반드시 JSON만 반환하세요.`;

export function buildGuideGenerationPrompt(rawText: string, glossary: Record<string, string>) {
  return `전사 공통 용어집:\n${JSON.stringify(glossary, null, 2)}\n\n고정 촬영 주의사항:\n${FIXED_SHOOTING_NOTICE_KO}\n\n오리엔시트 원문:\n${rawText}\n\n아래 JSON 구조로 반환하세요:\n{
  "basic": [{"titleKo":"", "bodyKo":"", "titleJa":"", "bodyJa":""}],
  "product": [{"titleKo":"", "bodyKo":"", "titleJa":"", "bodyJa":""}],
  "content": [],
  "notice": [{"titleKo":"투고 시 주의사항", "bodyKo":"", "titleJa":"投稿時の注意事項", "bodyJa":""}],
  "hashtags": ["#..."]
}`;
}
