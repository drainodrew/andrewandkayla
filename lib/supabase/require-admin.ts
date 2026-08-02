import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Verify the caller is a signed-in admin, for use at the top of server actions.
 *
 * Why this exists: the (dashboard) layout's auth check protects PAGE RENDERS,
 * not server actions. A Next.js server action compiles to a POST endpoint with
 * a generated id, and that id ships in the client bundle. It is obscure, not
 * secret. Anything that only guards the page leaves the mutation endpoints
 * reachable by anyone who reads the JS and replays the request, with no
 * session at all.
 *
 * Since every seating action runs on the service role (which bypasses RLS
 * entirely), an unguarded action is a straight path to writing the database
 * unauthenticated. So each one asserts here first.
 */
export async function requireAdmin(): Promise<
  { email: string; error?: undefined } | { email?: undefined; error: string }
> {
  const supabase = await createAuthServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "You need to be signed in to do that." };
  }

  // Same allowlist the dashboard layout checks. Service role because
  // admin_users is behind RLS.
  const service = createServiceClient();
  const { data: adminUser } = await service
    .from("admin_users")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();

  if (!adminUser) {
    return { error: "That account isn't an admin." };
  }

  return { email: user.email };
}
