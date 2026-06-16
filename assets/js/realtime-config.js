/* =====================================================================
   Supabase Realtime config (multiplayer presence + character sync)
   ---------------------------------------------------------------------
   The Supabase anon key is a PUBLIC client key — safe to ship in a static
   site. Multiplayer uses only Realtime "presence" + "broadcast" (ephemeral,
   no database tables, no RLS needed), so the free tier is plenty.

   HOW TO ENABLE
   1. Create a project at https://supabase.com  (Realtime is on by default).
   2. Project Settings → API → copy the "Project URL" and the "anon public" key.
   3. Provide them one of two ways:
        a) Local/dev + CI build (recommended): set env vars
             VITE_SUPABASE_URL=https://xxxx.supabase.co
             VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
           in a .env file (gitignored) and/or as GitHub Actions repo
           variables (see .github/workflows/deploy.yml).
        b) Or just hard-code them into FALLBACK_URL / FALLBACK_ANON_KEY below.

   If neither is set, the site runs fine in single-player — multiplayer
   simply stays dormant (no errors).
   ===================================================================== */

const ENV = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

// Optional hard-coded fallback (leave blank to rely on env vars only)
const FALLBACK_URL = '';
const FALLBACK_ANON_KEY = '';

export const SUPABASE_URL = ENV.VITE_SUPABASE_URL || FALLBACK_URL || '';
export const SUPABASE_ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY || '';
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
