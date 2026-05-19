import { IMPRINT } from '@/lib/constants';
import ImpressumPage from '@/components/legal/ImpressumPage';

export const metadata = {
  title: 'Impressum',
  robots: { index: false },
};

export default function Page() {
  if (!IMPRINT) {
    return (
      <main className="min-h-screen bg-[--color-bg] text-[--color-text] px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-[--color-text-muted]">Kein Impressum erforderlich / No imprint required</p>
        </div>
      </main>
    );
  }

  return <ImpressumPage imprint={IMPRINT} />;
}
