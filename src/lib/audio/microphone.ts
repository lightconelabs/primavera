/**
 * Microphone input and real-time pitch detection using pitchy.
 * Connects getUserMedia to an AnalyserNode and polls for pitch.
 */

import { PitchDetector } from 'pitchy';

export interface PitchResult {
	midi: number | null;
	exactMidi: number | null;
	cents: number | null;
	frequency: number | null;
	clarity: number | null;
}

export type PitchCallback = (result: PitchResult) => void;

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let detector: PitchDetector<Float32Array> | null = null;
let mediaStream: MediaStream | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let inputBuffer: Float32Array | null = null;
let callback: PitchCallback | null = null;
let paused = false;

const POLL_INTERVAL_MS = 50;
const MIN_CLARITY = 0.85;

function getAudioContext(): AudioContext {
	if (!audioContext) {
		audioContext = new AudioContext();
	}
	return audioContext;
}

export async function startListening(onPitch: PitchCallback): Promise<void> {
	stopListening();

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

	detector = PitchDetector.forFloat32Array(analyser.fftSize);
	detector.minVolumeDecibels = -50;
	inputBuffer = new Float32Array(detector.inputLength);

	intervalId = setInterval(poll, POLL_INTERVAL_MS);
}

function poll() {
	if (!analyser || !callback || !detector || !inputBuffer) return;
	if (paused) return;

	const ctx = getAudioContext();
	if (ctx.state === 'suspended') {
		ctx.resume();
		return;
	}

	const pitchBuffer = inputBuffer as Float32Array<ArrayBuffer>;
	analyser.getFloatTimeDomainData(pitchBuffer);
	const [pitch, clarity] = detector.findPitch(pitchBuffer, ctx.sampleRate);

	if (clarity >= MIN_CLARITY && pitch > 60 && pitch < 1200) {
		const exactMidi = 69 + 12 * Math.log2(pitch / 440);
		const midi = Math.round(exactMidi);
		const cents = Math.round((exactMidi - midi) * 100);
		callback({ midi, exactMidi, cents, frequency: pitch, clarity });
	} else {
		callback({ midi: null, exactMidi: null, cents: null, frequency: null, clarity });
	}
}

export function pauseListening(): void {
	paused = true;
}

export function resumeListening(): void {
	paused = false;
}

export function stopListening(): void {
	if (intervalId !== null) {
		clearInterval(intervalId);
		intervalId = null;
	}
	if (mediaStream) {
		mediaStream.getTracks().forEach((track) => track.stop());
		mediaStream = null;
	}
	analyser = null;
	detector = null;
	inputBuffer = null;
	callback = null;
	paused = false;
}

export function isMicSupported(): boolean {
	return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
