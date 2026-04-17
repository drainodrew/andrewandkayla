import { createClient } from "@supabase/supabase-js";

/**
 * Browser-safe Supabase client using the anon/public key.
 * This respects RLS policies. Used for admin auth flows
 * and any client-side reads that go through RLS.
 */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, key);
}
