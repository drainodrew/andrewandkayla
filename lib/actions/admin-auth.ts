"use server";

import { createAuthServerClient } from "@/lib/supabase/auth-server";

/**
 * Sign out the current admin user by calling Supabase Auth signOut,
 * which clears the session cookies.
 */
export async function signOut() {
  const supabase = await createAuthServerClient();
  await supabase.auth.signOut();
  return { success: true };
}
