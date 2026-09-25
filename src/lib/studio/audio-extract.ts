import { loadMediaBlob } from './media-db';

export async function extractAudioForTranscription(
  clips: Array<{ type: string; sourceUrl?: string; id: string }>,
): Promise<{ file?: File; url?: string } | null> {
  const audioClip = clips.find(c => c.type === 'audio' && c.sourceUrl);
  const videoClip = clips.find(c => c.type === 'video' && c.sourceUrl);
  const target = audioClip || videoClip;

  if (!target?.sourceUrl) return null;

  const url = target.sourceUrl;

  if (url.startsWith('idb://')) {
    const blobId = url.replace('idb://', '');
    const blobUrl = await loadMediaBlob(blobId);
    if (!blobUrl) return null;
    // loadMediaBlob returns a blob: URL — fetch it to get the actual Blob
    const res = await fetch(blobUrl);
    const blob = await res.blob();
    return { file: new File([blob], 'audio.mp3', { type: blob.type || 'audio/mpeg' }) };
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return { url };
  }

  if (url.startsWith('data:')) {
    const res = await fetch(url);
    const blob = await res.blob();
    return { file: new File([blob], 'audio.mp3', { type: blob.type || 'audio/mpeg' }) };
  }

  return null;
}
