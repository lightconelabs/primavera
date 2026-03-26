/**
 * Real-time monophonic pitch detection using the YIN algorithm.
 * Zero dependencies — uses only typed arrays.
 *
 * Reference: de Chevigne & Kawahara (2002), JASA 111, 1917-1930
 */

/** Compute RMS amplitude of an audio buffer. Used to gate silence. */
export function computeRMS(buffer: Float32Array): number {
	let sum = 0;
	for (let i = 0; i < buffer.length; i++) {
		sum += buffer[i] * buffer[i];
	}
	return Math.sqrt(sum / buffer.length);
}

/**
 * YIN pitch detection algorithm.
 * Returns detected frequency in Hz, or null if no clear pitch found.
 */
export function detectPitch(
	buffer: Float32Array,
	sampleRate: number,
	threshold = 0.15
): number | null {
	if (computeRMS(buffer) < 0.01) return null;

	let bufferSize = 1;
	while (bufferSize < buffer.length) bufferSize *= 2;
	bufferSize /= 2;

	const halfLen = Math.floor(bufferSize / 2);
	const yinBuffer = new Float32Array(halfLen);

	// Step 1: Difference function
	for (let tau = 1; tau < halfLen; tau++) {
		for (let i = 0; i < halfLen; i++) {
			const delta = buffer[i] - buffer[i + tau];
			yinBuffer[tau] += delta * delta;
		}
	}

	// Step 2: Cumulative mean normalized difference
	yinBuffer[0] = 1;
	let runningSum = 0;
	for (let tau = 1; tau < halfLen; tau++) {
		runningSum += yinBuffer[tau];
		yinBuffer[tau] *= tau / runningSum;
	}

	// Step 3: Absolute threshold — find first dip below threshold
	let tau = 2;
	for (; tau < halfLen; tau++) {
		if (yinBuffer[tau] < threshold) {
			while (tau + 1 < halfLen && yinBuffer[tau + 1] < yinBuffer[tau]) {
				tau++;
			}
			break;
		}
	}

	if (tau === halfLen || yinBuffer[tau] >= threshold) return null;

	// Step 4: Parabolic interpolation for sub-sample precision
	const x0 = tau - 1;
	const x2 = tau + 1 < halfLen ? tau + 1 : tau;

	let betterTau: number;
	if (x2 === tau) {
		betterTau = yinBuffer[tau] <= yinBuffer[x0] ? tau : x0;
	} else {
		const s0 = yinBuffer[x0];
		const s1 = yinBuffer[tau];
		const s2 = yinBuffer[x2];
		betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
	}

	return sampleRate / betterTau;
}
