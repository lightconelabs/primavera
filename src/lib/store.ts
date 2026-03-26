/**
 * Persistent settings store using localStorage.
 */

import { DEFAULT_SETTINGS, type ExerciseSettings } from './music';

const STORAGE_KEY = 'primavera-settings';

export function loadSettings(): ExerciseSettings {
	if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			return { ...DEFAULT_SETTINGS, ...parsed };
		}
	} catch {
		// ignore
	}
	return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: ExerciseSettings): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// ignore
	}
}
