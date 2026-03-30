'use client';

import { useEffect, useRef } from 'react';

interface ShopMapProps {
  lat: number;
  lng: number;
  storeName: string;
  /** Map height in pixels */
  height?: number;
}

/**
 * Lightweight Leaflet map that reliably centers on the store location.
 * Loads Leaflet CSS + JS from CDN on mount — no npm dependency needed.
 */
export default function ShopMap({ lat, lng, storeName, height = 300 }: ShopMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    // Dynamically load Leaflet CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // Dynamically load Leaflet JS
    const loadLeaflet = (): Promise<LeafletStatic> => {
      const win = window as unknown as Record<string, unknown>;
      if (win.L) return Promise.resolve(win.L as LeafletStatic);

      return new Promise((resolve) => {
        const existing = document.querySelector('script[src*="leaflet"]');
        if (existing) {
          existing.addEventListener('load', () => resolve((window as unknown as Record<string, unknown>).L as LeafletStatic));
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.crossOrigin = '';
        script.onload = () => resolve((window as unknown as Record<string, unknown>).L as LeafletStatic);
        document.head.appendChild(script);
      });
    };

    loadLeaflet().then((L) => {
      if (!containerRef.current || mapInstanceRef.current) return;

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Custom green marker using SVG (no external marker images needed)
      const markerIcon = L.divIcon({
        html: `<svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="#16a34a"/>
          <circle cx="16" cy="15" r="7" fill="white"/>
        </svg>`,
        className: '',
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -36],
      });

      L.marker([lat, lng], { icon: markerIcon })
        .addTo(map)
        .bindPopup(`<strong>${storeName}</strong>`)
        .openPopup();

      mapInstanceRef.current = map;

      // Force recalc tiles after render
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    });

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as LeafletMap).remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl border border-gray-200"
      style={{ height, zIndex: 0 }}
    />
  );
}

// ── Minimal Leaflet type declarations (no @types/leaflet needed) ────────────

interface LeafletMap {
  remove(): void;
  invalidateSize(): void;
}

interface LeafletMarker {
  addTo(map: unknown): LeafletMarker;
  bindPopup(content: string): LeafletMarker;
  openPopup(): LeafletMarker;
}

interface LeafletTileLayer {
  addTo(map: unknown): LeafletTileLayer;
}

interface LeafletDivIcon {}

interface LeafletStatic {
  map(el: HTMLElement, options: Record<string, unknown>): LeafletMap & Record<string, unknown>;
  tileLayer(url: string, options: Record<string, unknown>): LeafletTileLayer;
  marker(latlng: [number, number], options?: Record<string, unknown>): LeafletMarker;
  divIcon(options: Record<string, unknown>): LeafletDivIcon;
}

interface WindowWithLeaflet extends Window {
  L: LeafletStatic;
}
