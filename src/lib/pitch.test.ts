import { describe, it, expect } from 'vitest';
import { detectPitch, computeRMS } from './pitch';

describe('computeRMS', () => {
	it('returns 0 for silence', () => {
		const silence = new Float32Array(1024);
		expect(computeRMS(silence)).toBe(0);
	});

	it('returns correct RMS for known signal', () => {
		const buffer = new Float32Array(1024).fill(0.5);
		expect(computeRMS(buffer)).toBeCloseTo(0.5, 5);
	});
});

describe('detectPitch', () => {
	function generateSineWave(freq: number, sampleRate: number, length: number): Float32Array {
		const buffer = new Float32Array(length);
		for (let i = 0; i < length; i++) {
			buffer[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
		}
		return buffer;
	}

	it('detects A4 (440 Hz) from a sine wave', () => {
		const buffer = generateSineWave(440, 44100, 2048);
		const result = detectPitch(buffer, 44100);
		expect(result).not.toBeNull();
		expect(result!).toBeCloseTo(440, -1);
	});

	it('detects C4 (261.63 Hz) from a sine wave', () => {
		const buffer = generateSineWave(261.63, 44100, 2048);
		const result = detectPitch(buffer, 44100);
		expect(result).not.toBeNull();
		expect(result!).toBeCloseTo(261.63, -1);
	});

	it('detects E5 (659.25 Hz) from a sine wave', () => {
		const buffer = generateSineWave(659.25, 44100, 2048);
		const result = detectPitch(buffer, 44100);
		expect(result).not.toBeNull();
		expect(result!).toBeCloseTo(659.25, -1);
	});

	it('returns null for silence', () => {
		const silence = new Float32Array(2048);
		const result = detectPitch(silence, 44100);
		expect(result).toBeNull();
	});
});
