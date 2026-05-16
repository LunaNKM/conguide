import { mockGuideTab } from "@/lib/mock-data";
import type { GuideTab } from "@/types/guide";

// Public guides are loaded on the client from Firestore collection `publicGuides`.
// This server helper remains only as a compatibility fallback for older imports.
export async function getPublicGuideByToken(token: string): Promise<GuideTab | null> {
  return token === mockGuideTab.shareToken ? mockGuideTab : null;
}
