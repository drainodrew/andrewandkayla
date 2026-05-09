/**
 * Root admin layout. Intentionally minimal.
 *
 * Auth guarding and the sidebar live in the (dashboard) route group
 * layout, so that the login page and auth callback (which sit directly
 * under /admin) are not wrapped by the auth check.
 */
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
