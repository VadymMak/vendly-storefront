export async function shareImage(imageUrl: string, title?: string): Promise<boolean> {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  const file = new File([blob], 'vendshop-creation.webp', { type: blob.type });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: title ?? 'Created with VendShop Studio',
        files: [file],
      });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
      throw e;
    }
  }

  return downloadImage(imageUrl);
}

export function downloadImage(imageUrl: string, filename?: string): boolean {
  const a = document.createElement('a');
  a.href = imageUrl;
  a.download = filename ?? `vendshop-${Date.now()}.webp`;
  a.click();
  return true;
}
