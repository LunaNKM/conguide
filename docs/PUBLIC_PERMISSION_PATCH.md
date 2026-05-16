# Public guide Firestore permission patch

## Problem
Public `/guide/[token]` pages were querying `campaignTabs` only by `shareToken`.
Firestore security rules allow anonymous reads only for published tabs, so anonymous queries must also include `status == "published"`.

## Fix
- `campaignTabs` public query now includes `where("status", "==", "published")`.
- `mediaAssets` query now includes both `itemId` and `tabId`, so media reads stay scoped to the currently published guide tab.

## File changed
- `components/guide/PublicGuideClient.tsx`
