"use client";

import { useState, useTransition } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

/**
 * Client component for the magic link login form.
 * Uses the browser Supabase client (anon key) to send OTP emails.
 */
export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const supabase = createBrowserClient();

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          // Redirect to the auth callback route after clicking the magic link
          emailRedirectTo: `${window.location.origin}/admin/auth/callback`,
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-sage/30 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-deep-sage"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h2 className="font-heading text-2xl text-deep-sage">Check your email</h2>
        <p className="text-dark/70 text-sm max-w-sm mx-auto">
          We sent a magic link to <strong className="text-dark">{email}</strong>.
          Click the link in the email to sign in.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
          className="text-sm text-deep-sage underline underline-offset-2 hover:text-dark transition-colors"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-dark/80 mb-2"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-lg border border-sage/50 bg-white text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full px-6 py-3 rounded-lg bg-pink text-dark font-medium hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-pink focus:ring-offset-2 focus:ring-offset-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Sending..." : "Send Magic Link"}
      </button>
    </form>
  );
}
