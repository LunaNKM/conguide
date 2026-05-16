# Disable Firebase Admin Seed API

This patch disables `app/api/firebase/seed/route.ts`.

The project no longer uses Firebase Admin SDK because service account key creation is unavailable under the current Google Cloud organization policy.

Sample data and public guide documents should be created from the authenticated admin dashboard using Firebase Client SDK and Firestore Rules.
