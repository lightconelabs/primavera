import { describe, it, expect } from 'vitest';
import { frequencyToMidi, midiToFrequency } from './music';

describe('frequencyToMidi', () => {
	it('converts A4 (440 Hz) to MIDI 69', () => {
		expect(frequencyToMidi(440)).toBe(69);
	});

	it('converts C4 (261.63 Hz) to MIDI 60', () => {
		expect(frequencyToMidi(261.63)).toBe(60);
	});

	it('is the inverse of midiToFrequency', () => {
		for (let midi = 48; midi <= 84; midi++) {
			expect(frequencyToMidi(midiToFrequency(midi))).toBe(midi);
		}
	});

	it('rounds to nearest MIDI for slightly off-pitch input', () => {
		expect(frequencyToMidi(445)).toBe(69);
		expect(frequencyToMidi(430)).toBe(69);
	});
});
