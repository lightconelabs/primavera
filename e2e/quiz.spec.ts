import { test, expect } from '@playwright/test';

test.describe('Quiz mode toggle', () => {
	test('mode toggle is visible with Practice and Quiz tabs', async ({ page }) => {
		await page.goto('/');

		const modeToggle = page.locator('.mode-toggle');
		await expect(modeToggle).toBeVisible();

		// Both tabs should be visible
		await expect(page.getByRole('tab', { name: /Practice/ })).toBeVisible();
		await expect(page.getByRole('tab', { name: /Quiz/ })).toBeVisible();
	});

	test('switching to quiz mode shows Start Quiz button', async ({ page }) => {
		await page.goto('/');

		// Click Quiz tab
		const quizTab = page.getByRole('tab', { name: /Quiz/ });
		await quizTab.click();

		// The QuizMode component should show the Start Quiz button
		await expect(page.getByRole('button', { name: 'Start Quiz' })).toBeVisible();

		// The Play button should NOT be visible in quiz mode
		await expect(page.getByRole('button', { name: 'Play' })).not.toBeVisible();
	});

	test('switching back to practice shows Play button', async ({ page }) => {
		await page.goto('/');

		// Switch to quiz mode first
		await page.getByRole('tab', { name: /Quiz/ }).click();
		await expect(page.getByRole('button', { name: 'Start Quiz' })).toBeVisible();

		// Switch back to practice
		await page.getByRole('tab', { name: /Practice/ }).click();

		// Play button should be visible again
		await expect(page.getByRole('button', { name: /Play/ })).toBeVisible();

		// Start Quiz button should no longer be visible
		await expect(page.getByRole('button', { name: 'Start Quiz' })).not.toBeVisible();
	});
});
