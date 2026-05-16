import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { mockGuideTab } from "@/lib/mock-data";
import { FIXED_SHOOTING_NOTICE_JA } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.FIREBASE_SEED_SECRET;
  const providedSecret = request.nextUrl.searchParams.get("secret");
  const adminEmail = request.nextUrl.searchParams.get("admin")?.toLowerCase();

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "Invalid seed secret." }, { status: 401 });
  }

  if (!adminEmail) {
    return NextResponse.json({ ok: false, error: "Missing admin email. Add ?admin=your@email.com" }, { status: 400 });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "Firebase admin environment variables are not configured." }, { status: 500 });
  }

  const db = getFirebaseAdminDb();

  await db.collection("allowedAdmins").doc(adminEmail).set({
    email: adminEmail,
    name: adminEmail.split("@")[0],
    createdAt: new Date().toISOString()
  }, { merge: true });

  const campaignRef = db.collection("campaigns").doc(mockGuideTab.campaignId);
  await campaignRef.set({
    campaignName: "Easydew 2026 Q2 メガワリ",
    brandName: mockGuideTab.brandName,
    status: "published",
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, { merge: true });

  const tabRef = db.collection("campaignTabs").doc(mockGuideTab.id);
  await tabRef.set({
    campaignId: mockGuideTab.campaignId,
    shareToken: mockGuideTab.shareToken,
    skuName: mockGuideTab.skuName,
    productName: mockGuideTab.productName,
    brandName: mockGuideTab.brandName,
    brandColor: mockGuideTab.brandColor,
    heroTitle: mockGuideTab.heroTitle,
    heroSubtitle: mockGuideTab.heroSubtitle,
    status: "published",
    sortOrder: 1,
    hashtags: mockGuideTab.hashtags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, { merge: true });

  for (const section of mockGuideTab.sections) {
    const sectionRef = tabRef.collection("sections").doc(section.id);
    await sectionRef.set({
      sectionType: section.sectionType,
      titleJa: section.titleJa,
      sortOrder: section.sortOrder,
      isCollapsible: section.isCollapsible,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    for (const item of section.items) {
      await sectionRef.collection("items").doc(item.id).set({
        titleKo: item.titleKo ?? "",
        bodyKo: item.bodyKo ?? "",
        titleJa: item.titleJa,
        bodyJa: item.id === "n1" ? FIXED_SHOOTING_NOTICE_JA : item.bodyJa,
        itemType: item.itemType,
        sortOrder: item.sortOrder,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  }

  await db.collection("glossaryGlobal").doc("mega-wari").set({ korean: "메가와리", japanese: "メガワリ", category: "promotion" }, { merge: true });
  await db.collection("glossaryGlobal").doc("qoo10").set({ korean: "큐텐", japanese: "Qoo10", category: "platform" }, { merge: true });
  await db.collection("systemTemplates").doc("fixedShootingNotice").set({
    titleKo: "반드시 읽어 주세요!",
    titleJa: "必ずお読みください！",
    bodyJa: FIXED_SHOOTING_NOTICE_JA
  }, { merge: true });

  return NextResponse.json({
    ok: true,
    message: "Firebase seed completed.",
    adminEmail,
    guideUrl: `/guide/${mockGuideTab.shareToken}`
  });
}
