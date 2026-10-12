import { MobilePlaceProducts } from '@/components/studio/mobile/MobilePlaceProducts';

interface Props {
  searchParams: Promise<{ cutout?: string | string[] }>;
}

// ?cutout= comes from the Remove BG result screen
export default async function PlaceProductsPage({ searchParams }: Props) {
  const { cutout } = await searchParams;
  const cutoutUrl = typeof cutout === 'string' && cutout.startsWith('https://') ? cutout : null;
  return <MobilePlaceProducts cutoutUrl={cutoutUrl} />;
}
