import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceClient } from "@/lib/supabase/server";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

/**
 * Admin login page.
 *
 * This page is NOT protected by the admin layout auth guard.
 * It has its own layout (no sidebar, centered card).
 * If the user is already authenticated as an admin, redirect to /admin.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Check if already authenticated
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    // Verify they're an admin before redirecting
    const serviceClient = createServiceClient();
    const { data: adminUser } = await serviceClient
      .from("admin_users")
      .select("id")
      .eq("email", user.email)
      .single();

    if (adminUser) {
      redirect("/admin");
    }
  }

  const params = await searchParams;
  const authError = params.error === "auth_failed";

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl text-deep-sage mb-2">
            A & K Admin
          </h1>
          <p className="text-dark/60 text-sm">
            Sign in to manage the wedding.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-sage/30 p-8">
          {authError && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 text-sm text-red-600">
              Authentication failed. Please try again.
            </div>
          )}

          <AdminLoginForm />
        </div>

        <p className="text-center text-xs text-dark/40 mt-6">
          Only authorized email addresses can sign in.
        </p>
      </div>
    </div>
  );
}
