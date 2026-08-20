import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/sidebar";

/**
 * Auth-guarded layout for the admin dashboard pages.
 *
 * Checks for a valid Supabase Auth session AND verifies
 * the user's email is in the admin_users allowlist. If either
 * check fails, redirects to the login page.
 *
 * This layout lives in the (dashboard) route group so that
 * /admin/login and /admin/auth/callback are NOT wrapped by it.
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createAuthServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/admin/login");
  }

  // Verify the user is in the admin_users allowlist.
  // Service role client bypasses RLS so we can query admin_users.
  const serviceClient = createServiceClient();
  const { data: adminUser } = await serviceClient
    .from("admin_users")
    .select("id")
    .eq("email", user.email)
    .single();

  if (!adminUser) {
    await supabase.auth.signOut();
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-cream print:block print:min-h-0 print:bg-white">
      {/* `contents` so this wrapper adds nothing to the flex layout on screen
          and exists only to carry print:hidden. The sidebar renders both an
          <aside> and a fixed hamburger <button>, so hiding it by element name
          in the print stylesheet would miss the button and leave a menu icon
          stamped on every printed page. */}
      <div className="contents print:hidden">
        <AdminSidebar email={user.email} />
      </div>
      {/* p-4 + pt-16 on mobile to clear the fixed hamburger button; p-8 on sm+.
          No padding in print: the @page margin is the paper's margin. */}
      <div className="flex-1 p-4 pt-16 sm:p-8 sm:pt-8 overflow-auto print:p-0 print:overflow-visible">
        {children}
      </div>
    </div>
  );
}
