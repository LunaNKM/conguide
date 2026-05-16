# Supabase cleanup note

This project now uses Firebase, not Supabase.

If the GitHub repository still contains these old paths, delete them manually:

- `supabase/`
- any old `lib/supabase/*` files, unless they are replaced by the compatibility shim in this patch

The compatibility shim is included only to prevent TypeScript build failures during the migration.
