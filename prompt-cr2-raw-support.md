# Prompt: Add CR2/RAW Image Format Support to Studio

## Goal
Add support for importing Canon CR2 and other RAW image formats into the Studio image pipeline and SlideshowCreator. The key requirement: convert on-the-fly server-side while preserving maximum quality (16-bit color depth, full dynamic range) until the final output step.

## Context
- Project: vendly-storefront (Next.js 15, App Router)
- Current upload route: `src/app/api/upload/route.ts` — accepts ONLY `image/jpeg, image/png, image/webp, image/gif`, max 5 MB
- Current slideshow: `src/components/studio/SlideshowCreator.tsx` — accepts `image/jpeg,image/png,image/webp,video/mp4,video/quicktime`
- Quality gate: `src/lib/image-pipeline/quality-gate.ts` — Sharp-based, expects standard formats
- Image upload component: `src/components/ui/ImageUpload.tsx` — accepts `image/jpeg,image/png,image/webp`
- Sharp is already installed and used throughout the pipeline
- DB import: `import { db } from '@/lib/db'` (NOT `prisma`)

## Important Rules
- CSS Modules for template components (not Tailwind)
- `import { db } from '@/lib/db'` for database access
- Superusers: makevytssvadym@gmail.com, akolesnyk1989@gmail.com, 777sdv@gmail.com
- Do NOT break existing format support — all current formats must continue to work

## RAW Format Background
- CR2 (Canon RAW) files are typically 20-30 MB, contain 14-bit sensor data
- Other common RAW: NEF (Nikon), ARW (Sony), DNG (Adobe), ORF (Olympus), RAF (Fuji), RW2 (Panasonic)
- Browsers CANNOT display RAW files natively — server-side conversion required
- Sharp can read some RAW formats via libvips (if compiled with libraw support)
- Alternative: use `dcraw` or `libraw` via Node native addon, or the `raw-decoder` npm package

## Implementation Plan

### Step 1: Install RAW processing dependency
```bash
# Option A: Check if Sharp/libvips already supports RAW
node -e "const sharp = require('sharp'); sharp('test.cr2').metadata().then(console.log).catch(e => console.log('Not supported:', e.message))"

# Option B: If Sharp doesn't support CR2, install dcraw-vendored or sharp with RAW support
# Check: npm install @aspect-build/libraw  OR  npm install dcraw
# Best option: use sharp with explicit raw() input for unprocessed sensor data
```

### Step 2: Create RAW conversion utility
Create `src/lib/image-pipeline/raw-converter.ts`:

```typescript
// Converts RAW camera files (CR2, NEF, ARW, DNG, etc.) to high-quality PNG/TIFF
// for further processing in the pipeline.
//
// Strategy:
// 1. Accept RAW buffer
// 2. Use dcraw (or libraw bindings) to extract full-resolution image
// 3. Output as 16-bit PNG or TIFF to preserve dynamic range
// 4. Pass to quality-gate.ts and rest of pipeline as usual

import sharp from 'sharp';

// MIME types for RAW formats (browsers report these inconsistently)
export const RAW_MIME_TYPES = new Set([
  'image/x-canon-cr2',
  'image/x-canon-crw',
  'image/x-nikon-nef',
  'image/x-sony-arw',
  'image/x-adobe-dng',
  'image/x-olympus-orf',
  'image/x-fuji-raf',
  'image/x-panasonic-rw2',
  'image/x-samsung-srw',
  'image/x-pentax-pef',
  // Some browsers use generic type
  'image/x-dcraw',
  'application/octet-stream', // fallback — check extension
]);

// File extensions for RAW formats
export const RAW_EXTENSIONS = new Set([
  '.cr2', '.cr3', '.crw',   // Canon
  '.nef', '.nrw',            // Nikon
  '.arw', '.srf', '.sr2',   // Sony
  '.dng',                     // Adobe DNG (universal)
  '.orf',                     // Olympus
  '.raf',                     // Fuji
  '.rw2',                     // Panasonic
  '.srw',                     // Samsung
  '.pef',                     // Pentax
  '.raw',                     // Generic
]);

export function isRawFile(mimeType: string, fileName: string): boolean {
  if (RAW_MIME_TYPES.has(mimeType)) return true;
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  return RAW_EXTENSIONS.has(ext);
}

export interface RawConversionResult {
  buffer: Buffer;       // High-quality PNG buffer
  width: number;
  height: number;
  originalFormat: string;
  bitDepth: number;     // 8 or 16
}

export async function convertRawToImage(
  rawBuffer: Buffer,
  fileName: string,
): Promise<RawConversionResult> {
  // Attempt 1: Try Sharp directly (works if libvips has RAW support)
  try {
    const metadata = await sharp(rawBuffer).metadata();
    if (metadata.width && metadata.height) {
      // Sharp can read it — convert to high-quality PNG
      const pngBuffer = await sharp(rawBuffer)
        .rotate()            // Auto-rotate from EXIF
        .png({ quality: 100 })
        .toBuffer();
      
      const pngMeta = await sharp(pngBuffer).metadata();
      return {
        buffer: pngBuffer,
        width: pngMeta.width!,
        height: pngMeta.height!,
        originalFormat: fileName.match(/\.([^.]+)$/)?.[1]?.toUpperCase() ?? 'RAW',
        bitDepth: metadata.depth === 'ushort' ? 16 : 8,
      };
    }
  } catch {
    // Sharp can't handle this RAW format — fall through to dcraw
  }

  // Attempt 2: Use dcraw via child_process
  // This requires dcraw to be installed on the server
  // For Vercel deployment: use a serverless-compatible RAW decoder
  const { execSync } = await import('child_process');
  const { writeFileSync, readFileSync, unlinkSync } = await import('fs');
  const { join } = await import('path');
  const os = await import('os');

  const tmpDir = os.tmpdir();
  const inputPath = join(tmpDir, `raw-${Date.now()}-${fileName}`);
  const outputPath = inputPath + '.tiff';

  try {
    writeFileSync(inputPath, rawBuffer);
    
    // dcraw: -T = TIFF output, -w = camera white balance, -H 0 = clip highlights
    // -6 = 16-bit output, -q 3 = high-quality interpolation
    execSync(`dcraw -T -w -H 0 -6 -q 3 "${inputPath}"`, {
      timeout: 30000, // 30s max
    });

    const tiffBuffer = readFileSync(outputPath);
    
    // Convert TIFF to PNG via Sharp for pipeline compatibility
    const pngBuffer = await sharp(tiffBuffer)
      .png({ quality: 100 })
      .toBuffer();

    const metadata = await sharp(pngBuffer).metadata();
    
    return {
      buffer: pngBuffer,
      width: metadata.width!,
      height: metadata.height!,
      originalFormat: fileName.match(/\.([^.]+)$/)?.[1]?.toUpperCase() ?? 'RAW',
      bitDepth: 16,
    };
  } finally {
    // Cleanup temp files
    try { unlinkSync(inputPath); } catch {}
    try { unlinkSync(outputPath); } catch {}
  }
}
```

### Step 3: Update upload route
File: `src/app/api/upload/route.ts`

```typescript
// Add to imports:
import { isRawFile, convertRawToImage, RAW_MIME_TYPES } from '@/lib/image-pipeline/raw-converter';

// Update ALLOWED list:
const ALLOWED_STANDARD = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// RAW files may come as application/octet-stream — validate by extension too

// In the POST handler, BEFORE the MIME check:
const fileName = file.name ?? 'upload';
const isRaw = isRawFile(file.type, fileName);

if (!isRaw && !ALLOWED_STANDARD.includes(file.type)) {
  return NextResponse.json({ error: 'Unsupported format' }, { status: 415 });
}

// Increase max size for RAW files (they're typically 20-30 MB)
const maxSize = isRaw ? 50 * 1024 * 1024 : 5 * 1024 * 1024; // 50 MB for RAW, 5 MB for standard
if (file.size > maxSize) {
  return NextResponse.json({ error: `File too large (max ${isRaw ? '50' : '5'} MB)` }, { status: 413 });
}

// If RAW, convert first then process normally
let buffer = Buffer.from(await file.arrayBuffer());
let processedMeta: { originalFormat?: string; bitDepth?: number } = {};

if (isRaw) {
  const result = await convertRawToImage(buffer, fileName);
  buffer = result.buffer; // Now it's a PNG
  processedMeta = { originalFormat: result.originalFormat, bitDepth: result.bitDepth };
}

// Continue with existing Sharp processing (resize, WebP output)...
```

### Step 4: Update SlideshowCreator
File: `src/components/studio/SlideshowCreator.tsx`

```typescript
// Update the file input accept attribute:
const ACCEPT_MEDIA = 'image/jpeg,image/png,image/webp,image/gif,.cr2,.cr3,.nef,.arw,.dng,.orf,.raf,.rw2,video/mp4,video/quicktime';

// In the file handler, for RAW files:
// Since browsers can't display RAW, we need server-side conversion for preview
// Add a conversion step: upload RAW → get back WebP preview URL → display in slideshow

// For each dropped file:
if (isRawExtension(file.name)) {
  // Upload to server for conversion
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'slideshow-preview');
  
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  const { url } = await res.json();
  
  // Use the converted preview URL
  slides.push({ type: 'image', src: url, originalFile: file.name, isConverted: true });
} else {
  // Existing logic: FileReader for standard images
}
```

### Step 5: Create new API route for RAW preview (optional optimization)
If you want a dedicated lightweight endpoint:
Create `src/app/api/convert-raw/route.ts` that:
- Accepts RAW file
- Converts to high-quality JPEG (not WebP, to preserve more detail)
- Returns the preview image directly (no Blob storage)
- Does NOT deduct credits (conversion is free, only generation costs credits)

### Step 6: Update quality-gate.ts
File: `src/lib/image-pipeline/quality-gate.ts`

```typescript
// The quality gate receives a Buffer — if it's already converted from RAW,
// it will be PNG format and should work as-is with Sharp.
// Just ensure the metadata tracking includes original format:

interface ImageAnalysis {
  // ... existing fields ...
  originalFormat?: string;  // 'CR2', 'NEF', etc. if converted from RAW
  wasRawConverted?: boolean;
}
```

### Step 7: Update ImageUpload component
File: `src/components/ui/ImageUpload.tsx`

```typescript
// Update accept to include RAW extensions:
accept="image/jpeg,image/png,image/webp,.cr2,.cr3,.nef,.arw,.dng,.orf,.raf,.rw2"

// Add indicator that RAW files will be converted:
// Show "Converting RAW..." spinner while upload processes
```

### Step 8: Test
```bash
# Get a sample CR2 file (Canon RAW)
# Test upload:
curl -X POST http://localhost:3000/api/upload \
  -H "Cookie: <session>" \
  -F "file=@sample.cr2" \
  -F "purpose=banner"

# Verify:
# 1. No error returned
# 2. Output is high-quality WebP
# 3. Dimensions preserved (typically 5472×3648 for Canon)
# 4. Colors look correct (white balance applied)

npx tsc --noEmit
```

## Deployment Consideration
- dcraw may not be available on Vercel Serverless by default
- Alternative for Vercel: use `@aspect-build/libraw` npm package (pure JS RAW decoder)
- Or: pre-process RAW files client-side using WebAssembly-based decoder before upload
- DNG format is the most universally supported by Sharp/libvips

## File Changes Summary
1. NEW: `src/lib/image-pipeline/raw-converter.ts` — RAW detection + conversion utility
2. EDIT: `src/app/api/upload/route.ts` — Accept RAW MIME types, convert before processing
3. EDIT: `src/components/studio/SlideshowCreator.tsx` — Accept RAW in file input, server-side preview
4. EDIT: `src/components/ui/ImageUpload.tsx` — Accept RAW extensions
5. EDIT: `src/lib/image-pipeline/quality-gate.ts` — Track original RAW format in metadata
6. OPTIONAL: `src/app/api/convert-raw/route.ts` — Dedicated lightweight RAW preview endpoint
