import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getOrCreateCredits, isSuperuser } from '@/lib/credits';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [credits, superuser] = await Promise.all([
    getOrCreateCredits(session.user.id),
    isSuperuser(session.user.id),
  ]);

  if (!credits.byokEnabled && !superuser) {
    return NextResponse.json({ byok: false });
  }

  // Resolve the decrypted API key from UserApiKey (canonical encrypted storage)
  const keyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
  });

  if (!keyRecord) {
    return NextResponse.json({ byok: false });
  }

  const apiKey = decrypt(keyRecord.encryptedKey);

  return NextResponse.json({
    byok: true,
    superuser,
    apiKey,
    models: {
      image:      'black-forest-labs/flux-schnell',
      startFrame: 'black-forest-labs/flux-schnell',
      video:      'kwaivgi/kling-v2.1',
      upscale:    'nightmareai/real-esrgan',
      removeBg:   'lucataco/remove-bg',
      aiEdit:     'black-forest-labs/flux-kontext-pro',
    },
  });
}
