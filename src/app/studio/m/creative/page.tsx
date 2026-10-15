import { Suspense } from 'react';
import { MobileCreativeEdit } from '@/components/studio/mobile/MobileCreativeEdit';

export default function CreativeEditPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />
      </div>
    }>
      <MobileCreativeEdit />
    </Suspense>
  );
}
