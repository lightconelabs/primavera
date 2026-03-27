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

function createDelay(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (signal?.aborted) {
			resolve();
			return;
		}

		const timeoutId = window.setTimeout(resolve, ms);
		signal?.addEventListener(
			'abort',
			() => {
				clearTimeout(timeoutId);
				resolve();
			},
			{ once: true }
		);
	});
}

/**
 * Play a single MIDI note with a piano-like envelope.
 * Returns a promise that resolves when the note finishes.
 */
export function playNote(
	midi: number,
	durationSec: number = 0.5,
	signal?: AbortSignal
): Promise<void> {
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

	let stopped = false;
	const stop = () => {
		if (stopped) return;
		stopped = true;
		const stopTime = ctx.currentTime;
		gainNode.gain.cancelScheduledValues(stopTime);
		gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.0001), stopTime);
		gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime + 0.03);
		osc1.stop(stopTime + 0.03);
		osc2.stop(stopTime + 0.03);
	};

	osc1.start(now);
	osc2.start(now);
	osc1.stop(now + durationSec);
	osc2.stop(now + durationSec);
	signal?.addEventListener('abort', stop, { once: true });

	return createDelay(durationSec * 1000, signal).finally(() => {
		signal?.removeEventListener('abort', stop);
	});
}

/**
 * Play a sequence of MIDI notes at a given tempo (BPM, quarter note = 1 beat).
 * Calls onNote(index) as each note starts playing, so the UI stays in sync.
 * Returns an abort controller that can cancel playback.
 */
export function playSequence(
	notes: { midi: number; duration: number }[],
	tempo: number,
	onNote?: (index: number) => void
): { promise: Promise<void>; abort: () => void } {
	const abortController = new AbortController();

	const abort = () => {
		abortController.abort();
	};

	const promise = (async () => {
		for (let i = 0; i < notes.length; i++) {
			if (abortController.signal.aborted) break;
			const note = notes[i];
			onNote?.(i);
			const beatDuration = 60 / tempo;
			const noteDuration = note.duration * beatDuration;
			await playNote(note.midi, noteDuration * 0.9, abortController.signal); // slight gap between notes
			if (!abortController.signal.aborted) {
				await createDelay(noteDuration * 0.1 * 1000, abortController.signal);
			}
		}
	})();

	return { promise, abort };
}
