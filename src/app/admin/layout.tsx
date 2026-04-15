'use client';

import { useState, useEffect } from 'react';

const ADMIN_PASS = 'vendshop2026';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword]     = useState('');
  const [checked, setChecked]       = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('vendshop-admin') === 'true') {
      setAuthorized(true);
    }
    setChecked(true);
  }, []);

  const handleLogin = () => {
    if (password === ADMIN_PASS) {
      sessionStorage.setItem('vendshop-admin', 'true');
      setAuthorized(true);
    }
  };

  if (!checked) return null;

  if (!authorized) return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#0B0F1A' }}>
      <div className="rounded-2xl p-8 text-center" style={{ background: '#1E293B' }}>
        <h2 className="mb-4 text-xl font-bold text-white">VendShop Admin</h2>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="Password"
          className="mb-3 w-64 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white"
        />
        <br />
        <button
          onClick={handleLogin}
          className="rounded-lg bg-green-600 px-8 py-3 font-semibold text-white hover:bg-green-700"
        >
          Login
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#0B0F1A' }}>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">VendShop Admin</h1>
          <button
            onClick={() => { sessionStorage.removeItem('vendshop-admin'); setAuthorized(false); }}
            className="text-sm text-gray-400 hover:text-white"
          >
            Logout
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
