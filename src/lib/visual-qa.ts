import Anthropic from '@anthropic-ai/sdk';

export interface QaReport {
  passed: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
  details: {
    heroReadable: boolean;
    navigationVisible: boolean;
    colorsConsistent: boolean;
    layoutCorrect: boolean;
    fontsLoaded: boolean;
  };
}

const FALLBACK_REPORT: QaReport = {
  passed: false,
  score: 0,
  issues: ['Failed to parse QA response'],
  recommendations: [],
  details: {
    heroReadable: false,
    navigationVisible: false,
    colorsConsistent: false,
    layoutCorrect: false,
    fontsLoaded: false,
  },
};

const USER_PROMPT = `Analyze this website screenshot for visual quality. Check:
1. Hero section: is text readable against background? Good contrast?
2. Navigation: is it visible and properly styled?
3. Colors: are they consistent, no clashing elements?
4. Layout: no broken elements, proper spacing, no overlaps?
5. Fonts: are they loaded (no fallback rectangles)?

Return ONLY valid JSON matching this structure:
{"passed": bool, "score": 0-100, "issues": [...], "recommendations": [...], "details": {"heroReadable": bool, "navigationVisible": bool, "colorsConsistent": bool, "layoutCorrect": bool, "fontsLoaded": bool}}

Score >= 70 means passed. Be strict about hero text readability.`;

export async function analyzeScreenshot(screenshotBuffer: Buffer): Promise<QaReport> {
  const client = new Anthropic();

  const base64Image = screenshotBuffer.toString('base64');

  let responseText: string;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'You are a visual QA engineer for web sites. Analyze the screenshot and return a JSON report.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: USER_PROMPT,
            },
          ],
        },
      ],
    });

    const firstContent = response.content[0];
    if (firstContent.type !== 'text') {
      return FALLBACK_REPORT;
    }
    responseText = firstContent.text;
  } catch {
    return FALLBACK_REPORT;
  }

  try {
    // Strip markdown code fences if model wrapped JSON in them
    const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as QaReport;

    return {
      passed: Boolean(parsed.passed),
      score: typeof parsed.score === 'number' ? parsed.score : 0,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      details: {
        heroReadable:        Boolean(parsed.details?.heroReadable),
        navigationVisible:   Boolean(parsed.details?.navigationVisible),
        colorsConsistent:    Boolean(parsed.details?.colorsConsistent),
        layoutCorrect:       Boolean(parsed.details?.layoutCorrect),
        fontsLoaded:         Boolean(parsed.details?.fontsLoaded),
      },
    };
  } catch {
    return FALLBACK_REPORT;
  }
}
