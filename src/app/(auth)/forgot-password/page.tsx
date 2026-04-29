"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/settings`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <div>
      <div className="lg:hidden text-center mb-8">
        <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F0EBE0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.1 17 3.1s.4 2 .4 4.9A12 12 0 0 1 11 20z" />
          </svg>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="font-heading text-2xl text-gray-900 mb-2">Check your email</h2>
            <p className="font-body text-sm text-gray-500 mb-6">
              We sent a password reset link to <strong>{email}</strong>
            </p>
            <Link
              href="/login"
              className="font-body text-sm text-brand-500 hover:text-brand-600 transition"
            >
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 className="font-heading text-2xl text-gray-900 mb-1">Reset password</h2>
            <p className="font-body text-sm text-gray-500 mb-8">
              Enter your email and we&apos;ll send you a reset link
            </p>

            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label className="block font-body text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 font-body text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 transition"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-body">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-body font-semibold text-sm transition disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="font-body text-sm text-gray-500 hover:text-brand-500 transition"
                >
                  ← Back to sign in
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
