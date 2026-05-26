import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";

/**
 * Browser-safe Supabase client using the anon/public key.
 * Uses @supabase/ssr so PKCE code verifiers are stored in
 * cookies (not localStorage), allowing the server callback
 * route to read them during exchangeCodeForSession().
 */
export function createBrowserClient() {
  return createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
