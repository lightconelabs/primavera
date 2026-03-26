/**
 * Web Audio API engine for playing notes using synthesized piano-like tones.
 */

import { midiToFrequency } from './music';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
	if (!audioContext) {
		audioContext = new AudioContext();
	}
	if (audioContext.state === 'suspended') {
		audioContext.resume();
	}
	return audioContext;
}

/**
 * Unlock the AudioContext on first user interaction.
 * Mobile browsers require AudioContext creation/resume within a direct gesture.
 */
export function unlockAudio(): void {
	const ctx = getAudioContext();
	if (ctx.state === 'suspended') {
		ctx.resume();
	}
}

/**
 * Play a single MIDI note with a piano-like envelope.
 * Returns a promise that resolves when the note finishes.
 */
export function playNote(midi: number, durationSec: number = 0.5): Promise<void> {
	const ctx = getAudioContext();
	const freq = midiToFrequency(midi);
	const now = ctx.currentTime;

	// Create oscillators for a richer tone
	const osc1 = ctx.createOscillator();
	const osc2 = ctx.createOscillator();
	const gainNode = ctx.createGain();

	osc1.type = 'triangle';
	osc1.frequency.setValueAtTime(freq, now);

	osc2.type = 'sine';
	osc2.frequency.setValueAtTime(freq * 2, now); // octave harmonic
	const osc2Gain = ctx.createGain();
	osc2Gain.gain.setValueAtTime(0.15, now);

	// ADSR-like envelope
	gainNode.gain.setValueAtTime(0, now);
	gainNode.gain.linearRampToValueAtTime(0.35, now + 0.02); // attack
	gainNode.gain.linearRampToValueAtTime(0.25, now + 0.1); // decay
	gainNode.gain.setValueAtTime(0.25, now + durationSec - 0.1); // sustain
	gainNode.gain.linearRampToValueAtTime(0, now + durationSec); // release

	osc1.connect(gainNode);
	osc2.connect(osc2Gain);
	osc2Gain.connect(gainNode);
	gainNode.connect(ctx.destination);

	osc1.start(now);
	osc2.start(now);
	osc1.stop(now + durationSec);
	osc2.stop(now + durationSec);

	return new Promise((resolve) => {
		setTimeout(resolve, durationSec * 1000);
	});
}

/**
 * Play a sequence of MIDI notes at a given tempo (BPM, quarter note = 1 beat).
 * Returns an abort controller that can cancel playback.
 */
export function playSequence(
	notes: { midi: number; duration: number }[],
	tempo: number
): { promise: Promise<void>; abort: () => void } {
	let aborted = false;

	const abort = () => {
		aborted = true;
	};

	const promise = (async () => {
		for (const note of notes) {
			if (aborted) break;
			const beatDuration = 60 / tempo;
			const noteDuration = note.duration * beatDuration;
			await playNote(note.midi, noteDuration * 0.9); // slight gap between notes
			if (!aborted) {
				await new Promise((r) => setTimeout(r, noteDuration * 0.1 * 1000));
			}
		}
	})();

	return { promise, abort };
}
