import puppeteer, { type Browser } from 'puppeteer-core';

const VIEWPORT_WIDTH  = 1440;
const VIEWPORT_HEIGHT = 900;
const TIMEOUT_MS      = 30_000;

async function getBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    // Production: use @sparticuz/chromium binary (required for Vercel serverless)
    const chromium = await import('@sparticuz/chromium');
    const executablePath = await chromium.default.executablePath();
    return puppeteer.launch({
      args: chromium.default.args,
      executablePath,
      headless: true,
    });
  }

  // Local dev: use system Chrome on macOS
  return puppeteer.launch({
    executablePath:
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

export async function takeScreenshot(url: string): Promise<Buffer> {
  let browser: Browser | null = null;

  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    await page.setViewport({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT_MS,
    });

    const screenshot = await page.screenshot({ type: 'png', fullPage: false });

    return Buffer.from(screenshot);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
