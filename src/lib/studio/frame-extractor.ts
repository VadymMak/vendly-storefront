import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { put } from '@vercel/blob';

/**
 * Extract last frame from a video URL using ffmpeg.
 * Uploads result to Vercel Blob and returns a persistent URL.
 * Returns null in MOCK mode or on failure.
 */
export async function extractLastFrame(videoUrl: string): Promise<string | null> {
  if (process.env.STUDIO_MOCK === 'true') return null;

  const ts = Date.now();
  const tmpVideo = `/tmp/scene-${ts}.mp4`;
  const tmpFrame = `/tmp/frame-${ts}.jpg`;

  try {
    const res = await fetch(videoUrl);
    if (!res.ok) return null;
    writeFileSync(tmpVideo, Buffer.from(await res.arrayBuffer()));

    // Seek 0.1 s from end to grab last frame
    execSync(
      `ffmpeg -sseof -0.1 -i ${tmpVideo} -vframes 1 -q:v 2 ${tmpFrame} -y`,
      { stdio: 'pipe' },
    );

    const frameBuffer = readFileSync(tmpFrame);
    const blob = await put(`studio/frames/${ts}.jpg`, frameBuffer, {
      access: 'public',
      contentType: 'image/jpeg',
    });
    console.log(`[continuity] extracted last frame → ${blob.url}`);
    return blob.url;
  } catch (err) {
    console.error('[continuity] extractLastFrame failed:', err);
    return null;
  } finally {
    try { unlinkSync(tmpVideo); } catch {}
    try { unlinkSync(tmpFrame); } catch {}
  }
}
