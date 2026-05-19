import { IMPRINT } from '@/lib/constants';
import DatenschutzPage from '@/components/legal/DatenschutzPage';

export const metadata = {
  title: 'Datenschutzerklärung',
  robots: { index: false },
};

export default function Page() {
  return <DatenschutzPage imprint={IMPRINT} />;
}
