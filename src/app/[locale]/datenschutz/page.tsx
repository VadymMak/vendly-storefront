import * as constants from '@/lib/constants';
import DatenschutzPage from '@/components/legal/DatenschutzPage';

const IMPRINT = (constants as Record<string, unknown>).IMPRINT as Record<string, string> | null | undefined;

export const metadata = {
  title: 'Datenschutzerklärung',
  robots: { index: false },
};

export default function Page() {
  return <DatenschutzPage imprint={IMPRINT} />;
}
