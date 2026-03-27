/**
 * Quiz pitch-evaluation engine.
 * Pure logic for detecting, smoothing, and scoring pitch input.
 */

import type { NoteName } from '$lib/music/model';
import { midiToFrequency } from '$lib/music/model';

const CHROMATIC_TO_NAME: NoteName[] = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];

export function midiToNoteName(midi: number): NoteName {
	const index = ((midi % 12) + 12) % 12;
	return CHROMATIC_TO_NAME[index];
}

export function pitchClass(midi: number): number {
	return ((midi % 12) + 12) % 12;
}

export function isNoteMatch(detectedMidi: number, expectedMidi: number): boolean {
	return pitchClass(detectedMidi) === pitchClass(expectedMidi);
}

/**
 * Compute gauge offset (-1 to 1) from detected pitch vs expected MIDI note.
 * Uses octave-folding so any octave of the correct note reads as "in tune".
 */
export function computeGaugeOffset(exactMidi: number, frequency: number, expectedMidi: number): number {
	const octaveShift = Math.round((exactMidi - expectedMidi) / 12) * 12;
	const nearestExpectedFreq = midiToFrequency(expectedMidi + octaveShift);
	const centsFromExpected = 1200 * Math.log2(frequency / nearestExpectedFreq);
	return Math.max(-1, Math.min(1, centsFromExpected / 100));
}

/**
 * Rolling-average smoother for the gauge needle.
 */
export class GaugeSmoother {
	private history: number[] = [];
	private windowSize: number;

	constructor(windowSize = 12) {
		this.windowSize = windowSize;
	}

	push(value: number): number {
		this.history.push(value);
		if (this.history.length > this.windowSize) this.history.shift();
		return this.history.reduce((a, b) => a + b, 0) / this.history.length;
	}

	reset(): void {
		this.history = [];
	}
}

/**
 * Stability detector: requires the same MIDI note for N consecutive frames.
 */
export class StabilityDetector {
	private lastMidi: number | null = null;
	private count = 0;
	private threshold: number;

	constructor(threshold = 5) {
		this.threshold = threshold;
	}

	/** Returns true when stability threshold is reached. */
	push(midi: number): boolean {
		if (midi === this.lastMidi) {
			this.count++;
		} else {
			this.lastMidi = midi;
			this.count = 1;
		}

		if (this.count >= this.threshold) {
			this.count = 0;
			this.lastMidi = null;
			return true;
		}
		return false;
	}

	reset(): void {
		this.lastMidi = null;
		this.count = 0;
	}
}
