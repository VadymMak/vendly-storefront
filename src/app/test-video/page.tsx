import { redirect } from 'next/navigation';

export default function TestVideoPage() {
  redirect('/studio?tab=video');
}
