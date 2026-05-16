/**
 * Legacy Supabase compatibility shim.
 *
 * This project has migrated to Firebase. This file exists only because an older
 * Supabase version may still remain in the GitHub repository after partial ZIP
 * uploads. Do not use this helper for new code.
 */
export function createClient() {
  throw new Error(
    "Supabase has been removed from this project. Use lib/firebase/client.ts instead."
  );
}
