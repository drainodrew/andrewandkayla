"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/admin-auth";
import { useTransition } from "react";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/guests", label: "Guests" },
  { href: "/admin/registry", label: "Registry" },
] as const;

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
      // Full page reload to clear client state and redirect to login
      window.location.href = "/admin/login";
    });
  }

  return (
    <aside className="w-64 shrink-0 border-r border-sage/30 bg-cream min-h-screen flex flex-col">
      <div className="px-6 py-6 border-b border-sage/30">
        <Link href="/admin" className="font-heading text-xl text-deep-sage">
          A & K Admin
        </Link>
      </div>

      <nav className="flex-1 px-4 py-4">
        <ul className="space-y-1">
          {ADMIN_NAV.map(({ href, label }) => {
            const isActive =
              href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(href);

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-pink/30 text-deep-sage"
                      : "text-dark/70 hover:bg-sage/20 hover:text-deep-sage"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-4 py-4 border-t border-sage/30">
        <p className="px-3 text-xs text-dark/50 truncate mb-2">{email}</p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isPending}
          className="w-full px-3 py-2 text-sm text-left rounded-md text-dark/70 hover:bg-sage/20 hover:text-deep-sage transition-colors disabled:opacity-50"
        >
          {isPending ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
