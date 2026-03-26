/**
 * Microphone input and real-time pitch detection.
 * Connects getUserMedia to an AnalyserNode and polls for pitch using YIN.
 */

import { detectPitch } from './pitch';
import { frequencyToMidi } from './music';

export interface PitchResult {
	/** Detected MIDI note number, or null if no pitch */
	midi: number | null;
	/** Detected frequency in Hz, or null */
	frequency: number | null;
}

export type PitchCallback = (result: PitchResult) => void;

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let mediaStream: MediaStream | null = null;
let rafId: number | null = null;
let callback: PitchCallback | null = null;

function getAudioContext(): AudioContext {
	if (!audioContext) {
		audioContext = new AudioContext();
	}
	return audioContext;
}

/** Start listening for pitch from the microphone. */
export async function startListening(onPitch: PitchCallback): Promise<void> {
	callback = onPitch;

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

	const buffer = new Float32Array(analyser.fftSize);
	analyser.getFloatTimeDomainData(buffer);

	const ctx = getAudioContext();
	const frequency = detectPitch(buffer, ctx.sampleRate);
	const midi = frequency !== null ? frequencyToMidi(frequency) : null;

	callback({ midi, frequency });

	rafId = requestAnimationFrame(poll);
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
}

/** Check if the browser supports getUserMedia. */
export function isMicSupported(): boolean {
	return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
