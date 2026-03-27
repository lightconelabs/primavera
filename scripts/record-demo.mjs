/**
 * Records an animated demo of Primavera using Playwright.
 *
 * Prerequisites:
 *   npm install --save-dev playwright
 *   npx playwright install chromium
 *
 * Usage:
 *   1. Start the dev server:  npm run dev -- --port 5199
 *   2. Record the video:      node scripts/record-demo.mjs
 *   3. Convert to GIF:        npm run demo:gif
 *
 * Or run everything at once:  npm run demo
 *
 * The script produces a .webm video in /tmp/primavera-demo/.
 * The demo:gif script converts it to assets/demo.gif using ffmpeg.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const VIDEO_DIR = '/tmp/primavera-demo';
const BASE_URL = process.env.DEMO_URL ?? 'http://localhost:5199';

mkdirSync(VIDEO_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 1000, height: 720 },
	recordVideo: {
		dir: VIDEO_DIR,
		size: { width: 1000, height: 720 }
	}
});

const page = await context.newPage();

// Navigate and wait for hydration
await page.goto(BASE_URL);
await page.waitForTimeout(3000);

// --- Scene 1: Show default C major exercise ---
await page.waitForTimeout(1500);

// Regenerate to show randomness
const newExBtn = page.locator('button.btn.primary');
await newExBtn.click();
await page.waitForTimeout(2000);

// --- Scene 2: Open settings and switch key signatures ---
const settingsToggle = page.locator('details.controls summary');
await settingsToggle.click();
await page.waitForTimeout(800);

// Key signature button layout:
//   [7♭  6♭  5♭  4♭  3♭  2♭  1♭] [♮] [1♯  2♯  3♯  4♯  5♯  6♯  7♯]
//    0    1    2    3    4    5   6   7    8    9   10   11   12   13  14
const buttons = page.locator('.key-row button');

// D major (2 sharps)
await buttons.nth(9).click();
await page.waitForTimeout(2000);

// E♭ major (3 flats)
await buttons.nth(4).click();
await page.waitForTimeout(2000);

// --- Scene 3: Widen the max interval ---
const intervalSlider = page.locator('#maxInterval');
await intervalSlider.fill('12');
await intervalSlider.dispatchEvent('change');
await page.waitForTimeout(1500);

// Generate a new exercise with wider intervals
await newExBtn.click();
await page.waitForTimeout(2000);

// --- Scene 4: Back to C major, tighter intervals, close settings ---
await buttons.nth(7).click(); // ♮ natural
await page.waitForTimeout(1000);
await intervalSlider.fill('5');
await intervalSlider.dispatchEvent('change');
await page.waitForTimeout(1000);

// Close settings
await settingsToggle.click();
await page.waitForTimeout(500);

await newExBtn.click();
await page.waitForTimeout(1500);

// --- Scene 5: Hover over notes to show highlight ---
const noteBoxes = await page.evaluate(() => {
	const notes = document.querySelectorAll('g.abcjs-note');
	return Array.from(notes).map((g) => {
		const head = g.querySelector('path.abcjs-notehead') ?? g.querySelector('path');
		if (!head) return null;
		const r = head.getBoundingClientRect();
		return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
	}).filter(Boolean);
});

for (let i = 0; i < Math.min(8, noteBoxes.length); i++) {
	await page.mouse.move(noteBoxes[i].x, noteBoxes[i].y);
	await page.waitForTimeout(500);
}

// Move mouse away
await page.mouse.move(500, 650);
await page.waitForTimeout(1000);

// --- Scene 6: Switch to Quiz mode ---
const quizTab = page.locator('.toggle-btn').filter({ hasText: 'Quiz' });
await quizTab.click();
await page.waitForTimeout(1500);

// Show the Start Quiz button
await page.getByRole('button', { name: 'Start Quiz' }).waitFor({ state: 'visible' });
await page.waitForTimeout(2000);

// --- Scene 7: Switch back to Practice and play the exercise ---
const practiceTab = page.locator('.toggle-btn').filter({ hasText: 'Practice' });
await practiceTab.click();
await page.waitForTimeout(1000);

const playBtn = page.locator('button.btn.secondary');
await playBtn.click();

// Wait for playback to finish (16 notes at 80 BPM = 12s, but let's just wait a reasonable time)
await page.waitForTimeout(8000);

// --- Scene 8: Switch language to NL ---
const nlLink = page.locator('.lang-switcher a').filter({ hasText: 'NL' });
await nlLink.click();
await page.waitForTimeout(3000);

// Finalize
await context.close();
await browser.close();

console.log(`Demo recording saved to ${VIDEO_DIR}/`);
console.log('Convert to GIF:  npm run demo:gif');
