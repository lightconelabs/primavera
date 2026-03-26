import { test, expect } from '@playwright/test';

test.describe('Exercise / Practice mode', () => {
	test('sheet music renders on load', async ({ page }) => {
		await page.goto('/');
		// The sheet music container should have an SVG rendered by abcjs
		const svg = page.locator('.sheet-music svg');
		await expect(svg.first()).toBeVisible();
	});

	test('new exercise generates different content', async ({ page }) => {
		await page.goto('/');
		// Wait for initial render
		const svg = page.locator('.sheet-music svg');
		await expect(svg.first()).toBeVisible();

		// Capture the initial SVG content
		const initialContent = await svg.first().innerHTML();

		// Click "New Exercise" multiple times to increase chance of different content
		const newExerciseBtn = page.getByRole('button', { name: 'New Exercise' });
		// Exercises are random, so try a few times
		let changed = false;
		for (let i = 0; i < 5; i++) {
			await newExerciseBtn.click();
			// Small wait for re-render
			await page.waitForTimeout(200);
			const newContent = await svg.first().innerHTML();
			if (newContent !== initialContent) {
				changed = true;
				break;
			}
		}
		expect(changed).toBe(true);
	});

	test('settings panel opens and has controls', async ({ page }) => {
		await page.goto('/');

		// The settings are inside a <details> element
		const details = page.locator('details.controls');
		await expect(details).toBeVisible();

		// Click the summary to open
		await details.locator('summary').click();

		// Check for interval slider
		const intervalSlider = page.locator('#maxInterval');
		await expect(intervalSlider).toBeVisible();

		// Check for note count slider
		const noteCountSlider = page.locator('#noteCount');
		await expect(noteCountSlider).toBeVisible();

		// Check for tempo slider
		const tempoSlider = page.locator('#tempo');
		await expect(tempoSlider).toBeVisible();
	});

	test('language switcher works', async ({ page }) => {
		await page.goto('/');

		// Verify we see English text initially
		await expect(page.getByRole('button', { name: 'New Exercise' })).toBeVisible();

		// Click the NL language link
		const nlLink = page.locator('nav.lang-switcher a', { hasText: 'NL' });
		await expect(nlLink).toBeVisible();
		await nlLink.click();

		// After navigation, verify Dutch text appears
		await expect(page.getByRole('button', { name: 'Nieuwe oefening' })).toBeVisible();
	});
});
