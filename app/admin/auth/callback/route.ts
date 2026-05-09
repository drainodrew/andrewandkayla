import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Auth callback route for Supabase magic link.
 *
 * When a user clicks the magic link in their email, Supabase redirects
 * here with a code in the URL. We exchange that code for a session,
 * set the auth cookies, then redirect to /admin.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    // No code means someone hit this route directly; send to login
    return NextResponse.redirect(new URL("/admin/login", origin));
  }

  const response = NextResponse.redirect(new URL("/admin", origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error.message);
    return NextResponse.redirect(
      new URL("/admin/login?error=auth_failed", origin)
    );
  }

  return response;
}
