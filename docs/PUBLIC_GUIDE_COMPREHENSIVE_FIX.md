# Public Guide Comprehensive Fix

This patch changes the public guide loading flow.

## Main change

Before:
- `/guide/[token]` queried `campaignTabs`, `guideSections`, `guideItems`, and `mediaAssets` directly as an anonymous user.
- Firestore Rules could reject any one of those collection queries.

After:
- Admin writes one prebuilt document to `publicGuides/{shareToken}`.
- `/guide/[token]` reads only that one document.
- Firestore Rules allow anonymous `get` for `publicGuides/{token}` only; list is disabled.

## After applying

1. Replace the files in this patch.
2. Publish `firebase/firestore.rules` in Firebase Console.
3. Redeploy Vercel.
4. Open `/admin` and click either:
   - `샘플 데이터`, or
   - `⟳` on an existing campaign row.
5. Open the share link again.
