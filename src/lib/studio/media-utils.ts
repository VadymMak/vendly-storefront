export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return fileToDataUrl(new File([blob], 'media', { type: blob.type }));
  } catch {
    // CORS fallback: try canvas for images
    return new Promise<string>(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(url); return; }
        ctx.drawImage(img, 0, 0);
        try { resolve(canvas.toDataURL('image/webp', 0.85)); }
        catch { resolve(url); }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });
  }
}
