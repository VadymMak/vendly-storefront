'use client';

import { useState } from 'react';
import { FAQ_ITEMS } from '@/lib/constants';

export default function FaqSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section id="faq" className="bg-white py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-secondary sm:text-4xl">
            Často kladené otázky
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral">
            Odpovede na najčastejšie otázky o VendShop.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {FAQ_ITEMS.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-200">
              <button
                onClick={() => toggle(item.id)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
              >
                <span className="font-medium text-secondary">{item.question}</span>
                <span className="ml-4 text-neutral">
                  {openId === item.id ? '−' : '+'}
                </span>
              </button>
              {openId === item.id && (
                <div className="border-t border-gray-100 px-6 py-4 text-neutral">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
