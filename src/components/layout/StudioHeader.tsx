'use client';
import { signOut } from 'next-auth/react';
import CreditCounter from '@/components/studio/CreditCounter';

interface Props {
  userEmail: string;
  credits?: number;
}

export function StudioHeader({ userEmail }: Props) {
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-white/10 bg-[#0a0a0f]/90 px-4 backdrop-blur-md">
      <a href="/studio" className="text-lg font-bold text-white">
        AI Studio
      </a>
      <div className="flex items-center gap-4">
        <CreditCounter />
        <span className="text-xs text-gray-400">{userEmail}</span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="cursor-pointer text-xs text-gray-500 hover:text-white"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
