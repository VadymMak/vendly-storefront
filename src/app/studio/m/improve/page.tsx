import { Suspense } from 'react';
import { MobileImproveEditor } from '@/components/studio/mobile/MobileImproveEditor';

export default function ImprovePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />
      </div>
    }>
      <MobileImproveEditor />
    </Suspense>
  );
}
