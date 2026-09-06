import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getOrCreateCredits, isSuperuser } from '@/lib/credits';
import { getVideoProvider } from '@/lib/video';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const videoProvider = getVideoProvider();
  // Model label/cost are public UI copy — returned regardless of BYOK status.
  const videoInfo = {
    videoModel: videoProvider.getDisplayName(),
    videoCost:  videoProvider.getCostEstimate(),
  };

  const [credits, superuser] = await Promise.all([
    getOrCreateCredits(session.user.id),
    isSuperuser(session.user.id),
  ]);

  if (!credits.byokEnabled && !superuser) {
    return NextResponse.json({ byok: false, ...videoInfo });
  }

  // Resolve the decrypted API key from UserApiKey (canonical encrypted storage)
  const keyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
  });

  if (!keyRecord) {
    return NextResponse.json({ byok: false, ...videoInfo });
  }

  const apiKey = decrypt(keyRecord.encryptedKey);

  return NextResponse.json({
    byok: true,
    superuser,
    apiKey,
    ...videoInfo,
    models: {
      image:      'black-forest-labs/flux-schnell',
      startFrame: 'black-forest-labs/flux-schnell',
      video:      videoProvider.getModelName(),
      upscale:    'nightmareai/real-esrgan',
      removeBg:   'lucataco/remove-bg',
      aiEdit:     'black-forest-labs/flux-kontext-pro',
    },
  });
}
