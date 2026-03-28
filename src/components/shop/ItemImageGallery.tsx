'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ColorSchemeTokens } from '@/lib/types';

interface ItemImageGalleryProps {
  images: string[];
  name: string;
  scheme: ColorSchemeTokens;
}

export default function ItemImageGallery({ images, name, scheme }: ItemImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className={`flex aspect-square items-center justify-center rounded-xl ${scheme.bgCard} ${scheme.border} border`}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-30">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      {/* Main image */}
      <div className={`relative aspect-square overflow-hidden rounded-xl ${scheme.border} border`}>
        <Image
          src={images[activeIndex]}
          alt={`${name} - ${activeIndex + 1}`}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          priority
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                i === activeIndex ? 'border-current opacity-100' : `${scheme.border} border opacity-60 hover:opacity-100`
              }`}
            >
              <Image
                src={img}
                alt={`${name} thumbnail ${i + 1}`}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
