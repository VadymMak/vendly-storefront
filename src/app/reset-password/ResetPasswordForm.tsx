'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';

interface ResetPasswordFormProps {
  token: string | null;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthShell title="Invalid reset link">
        <p className="mt-4 text-sm text-neutral">This link is incomplete or has expired.</p>
        <p className="mt-6 text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">Request a new link</Link>
        </p>
      </AuthShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Password updated">
        <p className="mt-4 text-sm text-neutral">
          Your password has been reset and you were signed out on all devices. Sign in with your new password.
        </p>
        <Link
          href="/login"
          className="mt-6 block w-full rounded-lg bg-primary px-4 py-2.5 text-center font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Sign in
        </Link>
      </AuthShell>
    );
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <AuthShell title="Reset your password" subtitle="Choose a new password for your account.">
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-secondary">
            New password
          </label>
          <input
            id="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            className={inputClass} placeholder="Min. 8 characters"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-secondary">
            Confirm password
          </label>
          <input
            id="confirmPassword" type="password" required autoComplete="new-password"
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass} placeholder="Repeat password"
          />
        </div>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <button
          type="submit" disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50 cursor-pointer"
        >
          {loading ? '...' : 'Reset password'}
        </button>
      </form>
    </AuthShell>
  );
}
