'use client';

import { useEffect, useCallback } from 'react';
import type { EditorShellProps } from '@/lib/types';
import { ProcessingOverlay } from './ProcessingOverlay';

function IconBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M19 12H5" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function EditorShell({
  title,
  creditCost,
  status,
  onBack,
  primaryAction,
  secondaryAction,
  error,
  children,
  sidebar,
  bottomPanel,
}: EditorShellProps) {
  const handleBack = useCallback(() => {
    if (status === 'processing' || status === 'result-ready') {
      if (!window.confirm('Discard changes and go back?')) return;
    }
    onBack();
  }, [status, onBack]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleBack]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0f172a]">
      {/* ── Header ── */}
      <div
        className="flex h-14 shrink-0 items-center justify-between px-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Left — back button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <IconBack />
          <span className="hidden sm:inline">Back</span>
        </button>

        {/* Center — title + credit badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{title}</span>
          {creditCost !== undefined && (
            <span className="rounded-full bg-green-950 px-2 py-0.5 text-xs font-medium text-green-400">
              · {creditCost} {creditCost === 1 ? 'credit' : 'credits'}
            </span>
          )}
        </div>

        {/* Right — secondary + primary */}
        <div className="flex items-center gap-2">
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              className="hidden rounded px-3 py-1.5 text-xs font-medium text-gray-300 transition-opacity disabled:opacity-40 hover:text-white sm:block"
              style={{ background: 'rgba(255,255,255,0.07)' }}
            >
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled || primaryAction.loading}
              className="rounded px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-40"
              style={{ background: '#16a34a' }}
            >
              {primaryAction.loading ? 'Processing…' : primaryAction.label}
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Main content */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Error toast */}
          {error && (
            <div className="mx-4 mt-3 shrink-0 rounded-lg border border-red-500/20 bg-red-950/40 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Children */}
          <div className="relative flex flex-1 overflow-auto">
            {children}
            <ProcessingOverlay visible={status === 'processing'} />
          </div>

          {/* Bottom panel */}
          {bottomPanel && (
            <div
              className="shrink-0 px-4 pb-4 pt-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
            >
              {bottomPanel}
            </div>
          )}
        </div>

        {/* Sidebar — side on desktop, below on mobile */}
        {sidebar && (
          <div
            className="shrink-0 overflow-y-auto p-4 md:w-72"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* md: border-left, mobile: border-top handled via md: below */}
            <div className="md:hidden" />
            {sidebar}
          </div>
        )}
      </div>

      {/* ── Mobile action bar (shown when actions exist) ── */}
      {(primaryAction || secondaryAction) && (
        <div
          className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 sm:hidden"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          {secondaryAction ? (
            <button
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              className="flex-1 rounded px-3 py-2 text-sm font-medium text-gray-300 transition-opacity disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.07)' }}
            >
              {secondaryAction.label}
            </button>
          ) : <div />}
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled || primaryAction.loading}
              className="flex-1 rounded px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
              style={{ background: '#16a34a' }}
            >
              {primaryAction.loading ? 'Processing…' : primaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
