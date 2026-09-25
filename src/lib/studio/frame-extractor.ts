import { execFile } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { put } from '@vercel/blob';

const execFileAsync = promisify(execFile);
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

/**
 * Extract last frame from a video URL using ffmpeg.
 * Uploads result to Vercel Blob and returns a persistent URL.
 * Returns null in MOCK mode or on failure.
 */
export async function extractLastFrame(videoUrl: string): Promise<string | null> {
  if (process.env.STUDIO_MOCK === 'true') return null;

  const id = randomUUID();
  const tmpVideo = `/tmp/scene-${id}.mp4`;
  const tmpFrame = `/tmp/frame-${id}.jpg`;

  try {
    const res = await fetch(videoUrl);
    if (!res.ok) return null;

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_VIDEO_BYTES) {
      console.warn('[continuity] video too large to extract frame');
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_VIDEO_BYTES) return null;
    writeFileSync(tmpVideo, buffer);

    await execFileAsync('ffmpeg', [
      '-sseof', '-0.1',
      '-i', tmpVideo,
      '-vframes', '1',
      '-q:v', '2',
      tmpFrame,
      '-y',
    ]);

    const frameBuffer = readFileSync(tmpFrame);
    const blob = await put(`studio/frames/${id}.jpg`, frameBuffer, {
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
