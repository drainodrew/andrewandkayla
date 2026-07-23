"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/admin-auth";
import { useState, useTransition, useEffect, useCallback } from "react";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/guests", label: "Guests" },
  { href: "/admin/add-guest", label: "Edit Guests" },
  { href: "/admin/registry", label: "Registry" },
] as const;

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change so navigating dismisses the menu
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
      window.location.href = "/admin/login";
    });
  }

  const sidebarContent = (
    <>
      <div className="px-6 py-6 border-b border-sage/30 flex items-center justify-between">
        <Link href="/admin" className="font-heading text-xl text-deep-sage">
          A & K Admin
        </Link>
        {/* Close button: only visible on mobile */}
        <button
          type="button"
          onClick={closeMobile}
          className="sm:hidden p-1 rounded-md text-dark/50 hover:text-deep-sage hover:bg-sage/20 transition-colors"
          aria-label="Close menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
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
    </>
  );

  return (
    <>
      {/* Hamburger button: fixed top-left, only on mobile */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="sm:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-cream border border-sage/30 text-deep-sage shadow-sm hover:bg-sage/20 transition-colors"
        aria-label="Open menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Desktop sidebar: always visible at sm+ */}
      <aside className="hidden sm:flex w-64 shrink-0 border-r border-sage/30 bg-cream min-h-screen flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          {/* Backdrop: tap to close */}
          <div
            className="fixed inset-0 bg-black/30"
            onClick={closeMobile}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside className="relative z-10 w-64 bg-cream min-h-screen flex flex-col shadow-lg">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
