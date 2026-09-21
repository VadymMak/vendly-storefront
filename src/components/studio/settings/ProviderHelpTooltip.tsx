'use client';

import { useState } from 'react';
import type { ProviderHelp } from '@/lib/studio/provider-help';

interface Props {
  help: ProviderHelp;
}

export function ProviderHelpTooltip({ help }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] text-gray-400 hover:bg-white/20 hover:text-white transition-colors"
        aria-label={`How to get ${help.name} API key`}
      >
        ?
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-0 top-6 z-50 w-72 rounded-lg border border-white/10 bg-[#1a1a2e] p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-white">
                {help.icon} How to get {help.name} key
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <ol className="mb-2 list-decimal space-y-1 pl-4">
              {help.steps.map((step, i) => (
                <li key={i} className="text-[11px] text-gray-300 leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>

            <div className="space-y-1 border-t border-white/5 pt-2">
              <p className="text-[10px] text-gray-500">
                Format: <span className="font-mono text-gray-400">{help.keyFormat}</span>
              </p>
              <p className="text-[10px] text-gray-500">{help.pricing}</p>
            </div>

            <a
              href={help.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center rounded-md bg-green-600/20 px-3 py-1.5 text-xs text-green-400 hover:bg-green-600/30 transition-colors"
            >
              Get API key →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
