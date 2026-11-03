import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const origin = process.argv[2] ?? 'http://127.0.0.1:3100';
const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  for (const width of [390, 1440, 2555]) {
    const page = await browser.newPage({
      viewport: { width, height: 609 },
      reducedMotion: 'no-preference',
    });
    await page.goto(origin);
    await page.evaluate(() => document.fonts.ready);
    const marquee = await page.locator('.marquee-track').evaluate((track) => {
      const spans = [...track.children];
      return spans.slice(0, spans.length / 2).reduce((width, span) => width + span.getBoundingClientRect().width, 0);
    });
    assert.ok(marquee >= width, `marquee content (${marquee}px) must cover ${width}px throughout the loop`);
    const heading = page.locator('.questions .section-head');
    assert.equal(await heading.evaluate((el) => el.getBoundingClientRect().top > innerHeight), true);
    await heading.waitFor({ state: 'attached' });
    await page.waitForFunction(() => document.querySelector('.questions .section-head')?.classList.contains('reveal-pending'));
    await heading.evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
    await page.waitForFunction(() => document.querySelector('.questions .section-head')?.classList.contains('reveal-visible'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.questions .section-head')).opacity === '1');
    assert.equal(await heading.isVisible(), true);
    await page.close();
    console.log(`${width}px: section reveals on scroll`);
  }

  const page = await browser.newPage({
    viewport: { width: 1440, height: 609 },
    reducedMotion: 'reduce',
  });
  await page.goto(origin);
  const heading = page.locator('.questions .section-head');
  assert.equal(await heading.evaluate((el) => getComputedStyle(el).opacity), '1');
  assert.equal(await heading.evaluate((el) => el.classList.contains('reveal-pending')), false);
  await page.close();
  console.log('reduced motion: section remains visible');
} finally {
  await browser.close();
}
