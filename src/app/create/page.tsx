import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import CreatePageClient from '@/components/create/CreatePageClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('create.meta');
  return { title: t('title'), description: t('desc') };
}

export default async function CreatePage() {
  return <CreatePageClient />;
}
