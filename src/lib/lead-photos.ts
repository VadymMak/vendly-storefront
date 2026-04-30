/**
 * Unified photo access for Lead rows.
 *
 * The wizard, brief form and admin upload historically wrote to three
 * different fields (heroPhotoUrl/galleryUrls vs. photoUrls). The create-site
 * pipeline only read photoUrls, so wizard photos never reached the Sonnet
 * prompt. The new `Lead.photos` Json field unifies storage.
 *
 * During the transition period both writers dual-write (new field + old
 * fields) so that any reader still on the old code keeps working. Readers
 * should call getLeadPhotos to get a normalised { hero, gallery } shape
 * regardless of which writer produced the row.
 */

// Source shape — only the fields needed by getLeadPhotos. Using a structural
// type instead of importing the full Prisma Lead avoids tight coupling and
// makes the helper trivially callable with partial selects.
export interface LeadPhotosSource {
  photos?:       unknown;
  heroPhotoUrl?: string | null;
  galleryUrls?:  string[];
  photoUrls?:    string | null;
}

export interface LeadPhotos {
  hero:    string | null;
  gallery: string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function readNewField(value: unknown): LeadPhotos | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const hero    = typeof obj.hero === 'string' && obj.hero.trim() !== '' ? obj.hero : null;
  const gallery = isStringArray(obj.gallery)
    ? obj.gallery.filter((u) => u.trim() !== '')
    : [];
  return { hero, gallery };
}

/**
 * Read photos from a Lead row with fallback to legacy fields.
 *
 * Priority:
 *   1. lead.photos (new field) if it parses as a valid { hero, gallery } object
 *   2. lead.heroPhotoUrl + lead.galleryUrls (wizard's legacy fields)
 *   3. lead.photoUrls JSON-string (brief form's legacy field) → gallery only,
 *      hero stays null. The caller can resolve a hero from the gallery via
 *      heroImageIndex if needed (e.g. create-site).
 *   4. Empty default { hero: null, gallery: [] }
 */
export function getLeadPhotos(lead: LeadPhotosSource): LeadPhotos {
  const fromNew = readNewField(lead.photos);
  if (fromNew && (fromNew.hero || fromNew.gallery.length > 0)) {
    return fromNew;
  }

  const hero = lead.heroPhotoUrl && lead.heroPhotoUrl.trim() !== ''
    ? lead.heroPhotoUrl
    : null;

  let gallery: string[] = [];
  if (lead.galleryUrls && lead.galleryUrls.length > 0) {
    gallery = lead.galleryUrls.filter((u) => typeof u === 'string' && u.trim() !== '');
  } else if (lead.photoUrls) {
    try {
      const parsed: unknown = JSON.parse(lead.photoUrls);
      if (isStringArray(parsed)) {
        gallery = parsed.filter((u) => u.trim() !== '');
      }
    } catch {
      // malformed JSON — treat as empty
    }
  }

  return { hero, gallery };
}

/**
 * Build the value to store in Lead.photos for Prisma writes. Returns a plain
 * JSON-serialisable object that Prisma accepts as InputJsonValue.
 */
export function serializeLeadPhotos(input: {
  hero?:    string | null;
  gallery?: string[];
}): { hero: string | null; gallery: string[] } {
  return {
    hero:    input.hero ?? null,
    gallery: input.gallery ?? [],
  };
}
