import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client that reads/writes auth cookies.
 * Uses the anon key (not service role) because auth sessions
 * are tied to the anon key's JWT. The service role client
 * bypasses RLS but does not participate in cookie-based auth.
 *
 * Use this in server components and server actions where you
 * need to check the current admin user's session.
 */
export async function createAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll can fail in server components (read-only context).
            // That's fine; the middleware or route handler will handle
            // writing cookies when it can.
          }
        },
      },
    }
  );
}
