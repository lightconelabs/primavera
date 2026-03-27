import { describe, it, expect } from 'vitest';
import { frequencyToMidi, midiToFrequency } from './model';

// Standard pitch reference values
const A4_FREQ = 440;
const A4_MIDI = 69;
const C4_FREQ = 261.63;
const C4_MIDI = 60;

// Range for round-trip testing (C3 to C6)
const MIDI_C3 = 48;
const MIDI_C6 = 84;

describe('frequencyToMidi', () => {
	it('converts A4 (440 Hz) to MIDI 69', () => {
		expect(frequencyToMidi(A4_FREQ)).toBe(A4_MIDI);
	});

	it('converts C4 (261.63 Hz) to MIDI 60', () => {
		expect(frequencyToMidi(C4_FREQ)).toBe(C4_MIDI);
	});

	it('is the inverse of midiToFrequency', () => {
		for (let midi = MIDI_C3; midi <= MIDI_C6; midi++) {
			expect(frequencyToMidi(midiToFrequency(midi))).toBe(midi);
		}
	});

	it('rounds to nearest MIDI for slightly off-pitch input', () => {
		expect(frequencyToMidi(445)).toBe(A4_MIDI);
		expect(frequencyToMidi(430)).toBe(A4_MIDI);
	});
});
