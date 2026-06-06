import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin-auth';

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.location',
  'places.businessStatus',
  'nextPageToken',
].join(',');

interface GooglePlace {
  id:                       string;
  displayName?:             { text: string; languageCode: string };
  formattedAddress?:        string;
  internationalPhoneNumber?: string;
  websiteUri?:              string;
  rating?:                  number;
  userRatingCount?:         number;
  primaryType?:             string;
  primaryTypeDisplayName?:  { text: string; languageCode: string };
  location?:                { latitude: number; longitude: number };
  businessStatus?:          string;
}

interface GooglePlacesResponse {
  places?:       GooglePlace[];
  nextPageToken?: string;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'GOOGLE_PLACES_API_KEY is not configured' }, { status: 500 });
  }

  const body       = await req.json() as { query?: string; city?: string; maxResults?: number };
  const query      = (body.query ?? '').trim();
  const city       = (body.city  ?? '').trim();
  const maxResults = Math.min(Math.max(body.maxResults ?? 20, 1), 60);

  if (!query || !city) {
    return Response.json({ error: 'query and city are required' }, { status: 400 });
  }

  try {
    const allPlaces: GooglePlace[] = [];
    let pageToken: string | undefined;
    const pagesNeeded = Math.ceil(maxResults / 20);

    for (let page = 0; page < pagesNeeded; page++) {
      const requestBody: Record<string, unknown> = {
        textQuery:    `${query} ${city}`,
        languageCode: 'sk',
        regionCode:   'SK',
        pageSize:     20,
      };
      if (pageToken) requestBody.pageToken = pageToken;

      const res = await fetch(PLACES_URL, {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'X-Goog-Api-Key':  apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[scout] Google Places error:', res.status, errorText);

        if (res.status === 403) {
          return Response.json(
            { error: 'Google Places API key is invalid or Places API (New) is not enabled' },
            { status: 403 },
          );
        }
        if (res.status === 429) {
          return Response.json(
            { error: 'Google Places rate limit exceeded. Try again in a minute.' },
            { status: 429 },
          );
        }
        return Response.json({ error: `Google Places API error (${res.status})` }, { status: 502 });
      }

      const data = await res.json() as GooglePlacesResponse;
      allPlaces.push(...(data.places ?? []));
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    const results = allPlaces.slice(0, maxResults).map(place => ({
      title:            place.displayName?.text ?? '—',
      phone:            place.internationalPhoneNumber ?? '',
      phoneUnformatted: place.internationalPhoneNumber?.replace(/\s+/g, '') ?? '',
      website:          place.websiteUri ?? null,
      totalScore:       place.rating ?? 0,
      address:          place.formattedAddress ?? '—',
      categoryName:     place.primaryTypeDisplayName?.text ?? place.primaryType ?? '—',
    }));

    return Response.json({ results, total: results.length });
  } catch (err) {
    console.error('[scout] Unexpected error:', err);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
