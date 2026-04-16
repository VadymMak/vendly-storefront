import {
  filterImages,
  analyzeImageQuality,
  autoFixImage,
  type ImageAnalysis,
} from './quality-gate';
import { analyzeImagesForHero } from './vision-analysis';
import { generateHeroImage, shouldRegenerate, isFluxEnabled } from './flux-generator';

// ─── Types ────────────────────────────────────────────────────────────────────

type Decision = 'PASS' | 'FIX' | 'REGENERATE' | 'SKIP';

interface CropSuggestion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HeroConfig {
  heroTextColor: string;
  heroOverlay: string;
  overlayOpacity: number;
  textPosition: 'top' | 'center' | 'bottom';
  cropSuggestion: CropSuggestion | null;
}

interface HeroImage {
  buffer: Buffer;
  name: string;
  isGenerated: boolean;
}

interface QualityReport {
  totalImages: number;
  passedCount: number;
  failedCount: number;
  generatedCount: number;
}

export interface PipelineResult {
  decision: Decision;
  heroImage: HeroImage | null;
  heroConfig: HeroConfig | null;
  qualityReport: QualityReport;
  warnings: string[];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_HERO_CONFIG: HeroConfig = {
  heroTextColor:  '#ffffff',
  heroOverlay:    'dark-40%',
  overlayOpacity: 40,
  textPosition:   'center',
  cropSuggestion: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isQualityGateEnabled(): boolean {
  return process.env.IMAGE_QUALITY_GATE === 'true';
}

function isVisionAnalysisEnabled(): boolean {
  return process.env.VISION_ANALYSIS_ENABLED === 'true';
}

/** Pick the best (largest resolution) image from a failed list. */
function bestByResolution(
  analyses: ImageAnalysis[],
  images: Array<{ buffer: Buffer; name: string }>,
): { analysis: ImageAnalysis; image: { buffer: Buffer; name: string } } | null {
  const sorted = [...analyses].sort(
    (a, b) => b.width * b.height - a.width * a.height,
  );
  const top = sorted[0];
  if (!top) return null;
  const img = images.find((i) => i.name === top.filePath);
  if (!img) return null;
  return { analysis: top, image: img };
}

// ─── runImagePipeline ─────────────────────────────────────────────────────────

export async function runImagePipeline(
  images: Array<{ buffer: Buffer; name: string }>,
  businessName: string,
  businessType: string,
): Promise<PipelineResult> {
  const warnings: string[] = [];
  let decision: Decision = 'SKIP';
  let heroImage: HeroImage | null = null;
  let heroConfig: HeroConfig | null = null;
  let generatedCount = 0;

  // ── a) Empty input ──────────────────────────────────────────────────────────
  if (images.length === 0) {
    warnings.push('No images provided');

    if (isFluxEnabled()) {
      try {
        const generated = await generateHeroImage(businessName, businessType, 'photo');
        if (generated) {
          heroImage = { buffer: generated.buffer, name: 'generated-hero.webp', isGenerated: true };
          heroConfig = DEFAULT_HERO_CONFIG;
          decision = 'REGENERATE';
          generatedCount = 1;
        }
      } catch (err) {
        warnings.push(`Generation failed on empty input: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      decision,
      heroImage,
      heroConfig,
      qualityReport: { totalImages: 0, passedCount: 0, failedCount: 0, generatedCount },
      warnings,
    };
  }

  // ── b) Quality gate ─────────────────────────────────────────────────────────
  let passed: ImageAnalysis[] = [];
  let failed: ImageAnalysis[] = [];

  if (!isQualityGateEnabled()) {
    // Skip gate — treat all as passed with dummy analyses
    passed = await Promise.all(
      images.map(({ buffer, name }) => analyzeImageQuality(buffer, name)),
    );
  } else {
    try {
      ({ passed, failed } = await filterImages(images));
    } catch (err) {
      warnings.push(`Quality gate failed, passing all images: ${err instanceof Error ? err.message : String(err)}`);
      passed = images.map(({ buffer, name }) => ({
        filePath: name, width: 0, height: 0, sizeKb: 0, format: 'unknown',
        isBlurry: false, brightness: 128, contrast: 50, passed: true, failReasons: [],
      }));
    }
  }

  // ── c) All failed — try autoFix then generate ───────────────────────────────
  if (passed.length === 0 && failed.length > 0) {
    const best = bestByResolution(failed, images);

    if (best) {
      try {
        const fixedBuffer = await autoFixImage(best.image.buffer);
        const reanalysis  = await analyzeImageQuality(fixedBuffer, best.image.name);

        if (reanalysis.passed) {
          passed = [reanalysis];
          // Replace buffer in images list for downstream use
          images = images.map((img) =>
            img.name === best.image.name ? { ...img, buffer: fixedBuffer } : img,
          );
          decision = 'FIX';
        } else {
          warnings.push(`AutoFix did not recover "${best.image.name}": ${reanalysis.failReasons.join('; ')}`);
        }
      } catch (err) {
        warnings.push(`AutoFix error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Still nothing passed → try Flux
    if (passed.length === 0) {
      if (isFluxEnabled()) {
        try {
          const generated = await generateHeroImage(businessName, businessType, 'photo');
          if (generated) {
            heroImage     = { buffer: generated.buffer, name: 'generated-hero.webp', isGenerated: true };
            heroConfig    = DEFAULT_HERO_CONFIG;
            decision      = 'REGENERATE';
            generatedCount = 1;
          } else {
            warnings.push('All images failed quality gate and generation returned null');
          }
        } catch (err) {
          warnings.push(`Generation error after gate failure: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        warnings.push('All images failed quality gate and generation unavailable');
      }

      return {
        decision,
        heroImage,
        heroConfig,
        qualityReport: {
          totalImages:   images.length,
          passedCount:   0,
          failedCount:   failed.length,
          generatedCount,
        },
        warnings,
      };
    }
  }

  // ── d) We have passed images — vision analysis + optional regen ─────────────
  decision = decision === 'FIX' ? 'FIX' : 'PASS';

  // Map passed analyses back to buffers
  const passedWithBuffers = passed
    .map((a) => {
      const img = images.find((i) => i.name === a.filePath);
      return img ? { buffer: img.buffer, name: img.name, analysis: a } : null;
    })
    .filter((x): x is { buffer: Buffer; name: string; analysis: ImageAnalysis } => x !== null);

  let bestScore = 0;
  let bestIdx   = 0;

  if (isVisionAnalysisEnabled()) {
    try {
      const visionResult = await analyzeImagesForHero(
        passedWithBuffers.map(({ buffer, name }) => ({ buffer, name })),
        businessType,
        businessName,
      );

      bestIdx   = visionResult.bestImageIndex;
      bestScore = visionResult.allScores[bestIdx]?.score ?? 0;

      heroConfig = {
        heroTextColor:  visionResult.heroTextColor,
        heroOverlay:    visionResult.heroOverlay,
        overlayOpacity: visionResult.overlayOpacity,
        textPosition:   visionResult.textPosition,
        cropSuggestion: visionResult.cropSuggestion,
      };
    } catch (err) {
      warnings.push(`Vision analysis failed, using defaults: ${err instanceof Error ? err.message : String(err)}`);
      heroConfig = DEFAULT_HERO_CONFIG;
    }
  } else {
    heroConfig = DEFAULT_HERO_CONFIG;
  }

  const bestImage = passedWithBuffers[bestIdx] ?? passedWithBuffers[0];
  if (bestImage) {
    heroImage = { buffer: bestImage.buffer, name: bestImage.name, isGenerated: false };
  }

  // Optional: try Flux if best score is too low
  if (shouldRegenerate(passed.length, bestScore) && isFluxEnabled()) {
    try {
      const generated = await generateHeroImage(businessName, businessType, 'photo');
      if (generated) {
        heroImage     = { buffer: generated.buffer, name: 'generated-hero.webp', isGenerated: true };
        heroConfig    = DEFAULT_HERO_CONFIG;
        decision      = 'REGENERATE';
        generatedCount = 1;
      }
    } catch (err) {
      warnings.push(`Optional Flux generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    decision,
    heroImage,
    heroConfig,
    qualityReport: {
      totalImages:   images.length,
      passedCount:   passed.length,
      failedCount:   failed.length,
      generatedCount,
    },
    warnings,
  };
}
