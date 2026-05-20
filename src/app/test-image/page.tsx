import { redirect } from 'next/navigation';

export default function TestImagePage() {
  redirect('/studio?tab=image');
}
