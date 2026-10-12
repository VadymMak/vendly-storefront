'use client';

import { useEffect, useRef, useCallback } from 'react';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  action?: string;
  /** Runtime site key (server-read env); falls back to the build-time NEXT_PUBLIC_ key */
  siteKey?: string;
  size?: 'invisible' | 'normal' | 'flexible' | 'compact';
  /** Script failed to load or the challenge errored */
  onError?: () => void;
  onExpire?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset:  (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export default function TurnstileWidget({
  onVerify, action = 'generate', siteKey, size = 'invisible', onError, onExpire,
}: TurnstileWidgetProps) {
  const sitekey      = siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef  = useRef<string | null>(null);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey,
      callback:           onVerify,
      'error-callback':   onError,
      'expired-callback': onExpire,
      action,
      size,
      'refresh-expired':  'auto',
    });
  }, [sitekey, onVerify, onError, onExpire, action, size]);

  useEffect(() => {
    if (!sitekey) return;
    if (window.turnstile) {
      renderWidget();
      return;
    }

    const script  = document.createElement('script');
    script.src    = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
    script.async  = true;
    script.onerror = () => onError?.();
    window.onTurnstileLoad = renderWidget;
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [sitekey, renderWidget, onError]);

  // Not configured (e.g. development without keys) — render nothing
  if (!sitekey) return null;

  return <div ref={containerRef} />;
}
