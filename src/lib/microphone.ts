/**
 * Microphone input and real-time pitch detection.
 * Connects getUserMedia to an AnalyserNode and polls for pitch using YIN.
 */

import { detectPitch } from './pitch';

export interface PitchResult {
	/** Detected MIDI note number (rounded), or null if no pitch */
	midi: number | null;
	/** Exact MIDI value (with fractional part for cents), or null */
	exactMidi: number | null;
	/** Cents deviation from nearest note (-50 to +50), or null */
	cents: number | null;
	/** Detected frequency in Hz, or null */
	frequency: number | null;
}

export type PitchCallback = (result: PitchResult) => void;

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let mediaStream: MediaStream | null = null;
let rafId: number | null = null;
let callback: PitchCallback | null = null;
let paused = false;

function getAudioContext(): AudioContext {
	if (!audioContext) {
		audioContext = new AudioContext();
	}
	return audioContext;
}

/** Start listening for pitch from the microphone. */
export async function startListening(onPitch: PitchCallback): Promise<void> {
	callback = onPitch;
	paused = false;

	const ctx = getAudioContext();
	if (ctx.state === 'suspended') {
		await ctx.resume();
	}

	mediaStream = await navigator.mediaDevices.getUserMedia({
		audio: {
			echoCancellation: false,
			noiseSuppression: false,
			autoGainControl: false,
			channelCount: 1
		}
	});

	const source = ctx.createMediaStreamSource(mediaStream);
	analyser = ctx.createAnalyser();
	analyser.fftSize = 2048;
	source.connect(analyser);
	// Do NOT connect to destination — no mic feedback

	poll();
}

function poll() {
	if (!analyser || !callback) return;

	if (!paused) {
		const buffer = new Float32Array(analyser.fftSize);
		analyser.getFloatTimeDomainData(buffer);

		const ctx = getAudioContext();
		const frequency = detectPitch(buffer, ctx.sampleRate);

		if (frequency !== null) {
			const exactMidi = 69 + 12 * Math.log2(frequency / 440);
			const midi = Math.round(exactMidi);
			const cents = Math.round((exactMidi - midi) * 100);
			callback({ midi, exactMidi, cents, frequency });
		} else {
			callback({ midi: null, exactMidi: null, cents: null, frequency: null });
		}
	}

	rafId = requestAnimationFrame(poll);
}

/** Temporarily pause pitch detection (e.g., while playing reference audio). */
export function pauseListening(): void {
	paused = true;
}

/** Resume pitch detection after a pause. */
export function resumeListening(): void {
	paused = false;
}

/** Stop listening and release the microphone. */
export function stopListening(): void {
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	if (mediaStream) {
		mediaStream.getTracks().forEach((track) => track.stop());
		mediaStream = null;
	}
	analyser = null;
	callback = null;
	paused = false;
}

/** Check if the browser supports getUserMedia. */
export function isMicSupported(): boolean {
	return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
