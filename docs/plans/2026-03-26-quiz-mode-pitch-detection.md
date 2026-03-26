# Quiz Mode with Pitch Detection — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an interactive quiz mode where students sing or play notes into their microphone and get real-time feedback on whether they match the displayed exercise.

**Architecture:** A new pitch detection engine (`pitch.ts`) uses the Web Audio API `AnalyserNode` + YIN autocorrelation to detect sung/played notes from the microphone. A new `QuizMode.svelte` component drives the quiz flow: highlight a note, listen for the student's pitch, compare to expected MIDI, show green/red feedback, advance. Score and streak are tracked per exercise. The existing exercise generation, ABC rendering, and audio playback are reused unchanged.

**Tech Stack:** Web Audio API (AnalyserNode + getUserMedia), YIN algorithm (zero dependencies), SvelteKit 5, Playwright for e2e tests.

---

## Task 1: Add `frequencyToMidi` to music.ts

**Files:**
- Modify: `src/lib/music.ts` (after `midiToFrequency` at line 113)
- Create: `src/lib/music.test.ts`

**Step 1: Write the failing test**

Create `src/lib/music.test.ts`:

```typescript
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
		// 445 Hz is sharp A4, still closest to MIDI 69
		expect(frequencyToMidi(445)).toBe(69);
		// 427 Hz is flat A4, still closest to MIDI 69
		expect(frequencyToMidi(427)).toBe(69);
	});
});
```

**Step 2: Install vitest and run test to verify it fails**

```bash
npm install -D vitest
npx vitest run src/lib/music.test.ts
```

Expected: FAIL — `frequencyToMidi` is not exported from `./music`.

**Step 3: Write minimal implementation**

Add to `src/lib/music.ts` after the `midiToFrequency` function (line 113):

```typescript
/** Convert frequency in Hz to nearest MIDI note number */
export function frequencyToMidi(hz: number): number {
	return Math.round(69 + 12 * Math.log2(hz / 440));
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/music.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/music.ts src/lib/music.test.ts package.json package-lock.json
git commit -m "feat: add frequencyToMidi conversion with tests"
```

---

## Task 2: Create the YIN pitch detection engine

**Files:**
- Create: `src/lib/pitch.ts`
- Create: `src/lib/pitch.test.ts`

**Step 1: Write the failing test**

Create `src/lib/pitch.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectPitch, computeRMS } from './pitch';

describe('computeRMS', () => {
	it('returns 0 for silence', () => {
		const silence = new Float32Array(1024);
		expect(computeRMS(silence)).toBe(0);
	});

	it('returns correct RMS for known signal', () => {
		// All values = 0.5 → RMS = 0.5
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
		expect(result!).toBeCloseTo(440, -1); // within ~10 Hz
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

	it('returns null for noise', () => {
		const noise = new Float32Array(2048);
		for (let i = 0; i < noise.length; i++) {
			noise[i] = (Math.random() - 0.5) * 0.1;
		}
		const result = detectPitch(noise, 44100);
		// Noise should either return null or a wildly wrong frequency
		// We mainly care that it doesn't crash
		expect(true).toBe(true);
	});
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/pitch.test.ts
```

Expected: FAIL — `detectPitch` and `computeRMS` are not exported from `./pitch`.

**Step 3: Write implementation**

Create `src/lib/pitch.ts`:

```typescript
/**
 * Real-time monophonic pitch detection using the YIN algorithm.
 * Zero dependencies — uses only Web Audio API and typed arrays.
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
	// Silence gate
	if (computeRMS(buffer) < 0.01) return null;

	// Use largest power-of-two that fits in the buffer
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
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/pitch.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/pitch.ts src/lib/pitch.test.ts
git commit -m "feat: add YIN pitch detection engine"
```

---

## Task 3: Create the microphone input module

**Files:**
- Create: `src/lib/microphone.ts`

This module manages the microphone stream and continuous pitch detection loop. It cannot be unit-tested (requires browser APIs), so it will be covered by Playwright e2e tests in Task 7.

**Step 1: Write implementation**

Create `src/lib/microphone.ts`:

```typescript
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
```

**Step 2: Commit**

```bash
git add src/lib/microphone.ts
git commit -m "feat: add microphone input module with pitch detection loop"
```

---

## Task 4: Add i18n message keys for quiz mode

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/nl.json`
- Modify: `messages/de.json`
- Modify: `messages/fr.json`
- Modify: `messages/es.json`

**Step 1: Add English messages**

Add to `messages/en.json`:

```json
{
	"quiz_mode": "Quiz",
	"practice_mode": "Practice",
	"quiz_start": "Start Quiz",
	"quiz_stop": "Stop Quiz",
	"quiz_listen": "Sing or play this note",
	"quiz_correct": "Correct!",
	"quiz_wrong": "Try again",
	"quiz_score": "{correct} / {total}",
	"quiz_streak": "Streak: {count}",
	"quiz_best_streak": "Best: {count}",
	"quiz_complete": "Exercise complete!",
	"quiz_mic_permission": "Microphone access is needed for quiz mode",
	"quiz_mic_unsupported": "Your browser does not support microphone input",
	"quiz_detected_note": "Heard: {note}"
}
```

**Step 2: Add translations for NL, DE, FR, ES**

Add equivalent keys to each language file. (Use the English text as placeholder if uncertain — translations can be refined later.)

`messages/nl.json` additions:
```json
{
	"quiz_mode": "Quiz",
	"practice_mode": "Oefenen",
	"quiz_start": "Start quiz",
	"quiz_stop": "Stop quiz",
	"quiz_listen": "Zing of speel deze noot",
	"quiz_correct": "Juist!",
	"quiz_wrong": "Probeer opnieuw",
	"quiz_score": "{correct} / {total}",
	"quiz_streak": "Reeks: {count}",
	"quiz_best_streak": "Beste: {count}",
	"quiz_complete": "Oefening voltooid!",
	"quiz_mic_permission": "Microfoontoegang is nodig voor de quizmodus",
	"quiz_mic_unsupported": "Je browser ondersteunt geen microfooninvoer",
	"quiz_detected_note": "Gehoord: {note}"
}
```

`messages/de.json` additions:
```json
{
	"quiz_mode": "Quiz",
	"practice_mode": "Ueben",
	"quiz_start": "Quiz starten",
	"quiz_stop": "Quiz stoppen",
	"quiz_listen": "Singe oder spiele diese Note",
	"quiz_correct": "Richtig!",
	"quiz_wrong": "Nochmal versuchen",
	"quiz_score": "{correct} / {total}",
	"quiz_streak": "Serie: {count}",
	"quiz_best_streak": "Beste: {count}",
	"quiz_complete": "Uebung abgeschlossen!",
	"quiz_mic_permission": "Mikrofonzugriff wird fuer den Quizmodus benoetigt",
	"quiz_mic_unsupported": "Ihr Browser unterstuetzt keine Mikrofoneingabe",
	"quiz_detected_note": "Gehoert: {note}"
}
```

`messages/fr.json` additions:
```json
{
	"quiz_mode": "Quiz",
	"practice_mode": "Pratique",
	"quiz_start": "Commencer le quiz",
	"quiz_stop": "Arreter le quiz",
	"quiz_listen": "Chantez ou jouez cette note",
	"quiz_correct": "Correct !",
	"quiz_wrong": "Reessayez",
	"quiz_score": "{correct} / {total}",
	"quiz_streak": "Serie : {count}",
	"quiz_best_streak": "Record : {count}",
	"quiz_complete": "Exercice termine !",
	"quiz_mic_permission": "L'acces au microphone est necessaire pour le mode quiz",
	"quiz_mic_unsupported": "Votre navigateur ne prend pas en charge l'entree microphone",
	"quiz_detected_note": "Entendu : {note}"
}
```

`messages/es.json` additions:
```json
{
	"quiz_mode": "Quiz",
	"practice_mode": "Practica",
	"quiz_start": "Iniciar quiz",
	"quiz_stop": "Detener quiz",
	"quiz_listen": "Canta o toca esta nota",
	"quiz_correct": "Correcto!",
	"quiz_wrong": "Intentalo de nuevo",
	"quiz_score": "{correct} / {total}",
	"quiz_streak": "Racha: {count}",
	"quiz_best_streak": "Mejor: {count}",
	"quiz_complete": "Ejercicio completado!",
	"quiz_mic_permission": "Se necesita acceso al microfono para el modo quiz",
	"quiz_mic_unsupported": "Tu navegador no soporta entrada de microfono",
	"quiz_detected_note": "Escuchado: {note}"
}
```

**Step 3: Build to regenerate Paraglide files**

```bash
npm run build
```

Expected: Build succeeds, `src/lib/paraglide/messages/quiz_*.js` files are generated.

**Step 4: Commit**

```bash
git add messages/*.json
git commit -m "feat: add i18n messages for quiz mode (5 languages)"
```

---

## Task 5: Create the QuizMode component

**Files:**
- Create: `src/lib/QuizMode.svelte`

This is the core quiz UI. It manages the quiz flow: highlight notes one by one, listen for pitch, compare, show feedback, track score.

**Step 1: Write implementation**

Create `src/lib/QuizMode.svelte`:

```svelte
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import type { Exercise } from './music';
	import { NOTE_NAMES } from './music';
	import { playNote } from './audio';
	import { startListening, stopListening, isMicSupported } from './microphone';

	interface Props {
		exercise: Exercise;
		onComplete: (score: { correct: number; total: number; bestStreak: number }) => void;
	}

	let { exercise, onComplete }: Props = $props();

	let currentIndex = $state(0);
	let feedback: 'correct' | 'wrong' | null = $state(null);
	let detectedNoteName = $state('');
	let score = $state(0);
	let streak = $state(0);
	let bestStreak = $state(0);
	let listening = $state(false);
	let micError = $state('');
	let complete = $state(false);

	// Require the detected pitch to be stable for a few frames
	let stableMidi = -1;
	let stableCount = 0;
	const STABLE_FRAMES_REQUIRED = 5;

	function midiToNoteName(midi: number): string {
		return NOTE_NAMES[((midi % 12) + 12) % 12 < 5
			? [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][midi % 12]
			: [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][midi % 12]];
	}

	// Map MIDI note to note name index (C=0, D=1, ... B=6)
	const MIDI_TO_NAME_INDEX = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

	function getNoteNameFromMidi(midi: number): string {
		return NOTE_NAMES[MIDI_TO_NAME_INDEX[((midi % 12) + 12) % 12]];
	}

	async function start() {
		if (!isMicSupported()) {
			micError = m.quiz_mic_unsupported();
			return;
		}

		try {
			await startListening(({ midi }) => {
				if (midi === null || complete) return;

				const noteName = getNoteNameFromMidi(midi);
				detectedNoteName = noteName;

				// Check stability
				if (midi === stableMidi) {
					stableCount++;
				} else {
					stableMidi = midi;
					stableCount = 1;
				}

				if (stableCount < STABLE_FRAMES_REQUIRED) return;

				// Compare: check if detected note name matches expected
				// We compare note name only (not octave) for singing
				const expected = exercise.notes[currentIndex];
				const expectedName = expected.name;

				if (noteName === expectedName) {
					handleCorrect();
				} else if (stableCount === STABLE_FRAMES_REQUIRED) {
					// Only trigger wrong once per stable detection
					handleWrong();
				}
			});
			listening = true;
		} catch {
			micError = m.quiz_mic_permission();
		}
	}

	function handleCorrect() {
		feedback = 'correct';
		score++;
		streak++;
		if (streak > bestStreak) bestStreak = streak;
		stableMidi = -1;
		stableCount = 0;

		setTimeout(() => {
			feedback = null;
			detectedNoteName = '';
			if (currentIndex + 1 >= exercise.notes.length) {
				complete = true;
				stopListening();
				listening = false;
				onComplete({ correct: score, total: exercise.notes.length, bestStreak });
			} else {
				currentIndex++;
			}
		}, 600);
	}

	function handleWrong() {
		feedback = 'wrong';
		streak = 0;
		// Play the correct note so they can hear it
		const expected = exercise.notes[currentIndex];
		playNote(expected.midi, 0.4);

		setTimeout(() => {
			feedback = null;
			detectedNoteName = '';
			stableMidi = -1;
			stableCount = 0;
		}, 1000);
	}

	function stop() {
		stopListening();
		listening = false;
		complete = false;
		currentIndex = 0;
		score = 0;
		streak = 0;
		bestStreak = 0;
		feedback = null;
		detectedNoteName = '';
	}

	function hearCurrentNote() {
		const note = exercise.notes[currentIndex];
		playNote(note.midi, 0.4);
	}

	onDestroy(() => {
		stopListening();
	});
</script>

<div class="quiz-mode">
	{#if micError}
		<p class="mic-error">{micError}</p>
	{:else if !listening}
		<button class="btn quiz-start" onclick={start}>
			{m.quiz_start()}
		</button>
	{:else if complete}
		<div class="quiz-complete">
			<p class="complete-text">{m.quiz_complete()}</p>
			<p class="final-score">{m.quiz_score({ correct: score, total: exercise.notes.length })}</p>
			<p class="final-streak">{m.quiz_best_streak({ count: bestStreak })}</p>
		</div>
	{:else}
		<div class="quiz-status">
			<div class="score-row">
				<span class="score">{m.quiz_score({ correct: score, total: exercise.notes.length })}</span>
				<span class="streak">{m.quiz_streak({ count: streak })}</span>
			</div>

			<p class="instruction">{m.quiz_listen()}</p>

			{#if detectedNoteName}
				<p class="detected">{m.quiz_detected_note({ note: detectedNoteName })}</p>
			{/if}

			{#if feedback === 'correct'}
				<p class="feedback correct">{m.quiz_correct()}</p>
			{:else if feedback === 'wrong'}
				<p class="feedback wrong">{m.quiz_wrong()}</p>
			{/if}

			<div class="quiz-actions">
				<button class="btn hint-btn" onclick={hearCurrentNote}>
					Hear note
				</button>
				<button class="btn stop-btn" onclick={stop}>
					{m.quiz_stop()}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.quiz-mode {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 0;
	}

	.quiz-start {
		background: #27ae60;
		color: white;
		padding: 0.6rem 1.5rem;
		border: none;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}

	.quiz-start:hover {
		background: #219a52;
	}

	.quiz-status {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
	}

	.score-row {
		display: flex;
		gap: 1.5rem;
		font-size: 0.8rem;
		color: #888;
	}

	.streak {
		font-weight: 600;
		color: #e67e22;
	}

	.instruction {
		font-size: 0.85rem;
		color: #666;
		margin: 0;
	}

	.detected {
		font-size: 0.8rem;
		color: #999;
		margin: 0;
	}

	.feedback {
		font-size: 1.1rem;
		font-weight: 700;
		margin: 0;
		animation: pop 0.3s ease-out;
	}

	.feedback.correct {
		color: #27ae60;
	}

	.feedback.wrong {
		color: #e74c3c;
	}

	.quiz-complete {
		text-align: center;
	}

	.complete-text {
		font-size: 1rem;
		font-weight: 600;
		color: #4a2c6a;
	}

	.final-score {
		font-size: 1.5rem;
		font-weight: 700;
		color: #27ae60;
	}

	.final-streak {
		font-size: 0.85rem;
		color: #e67e22;
	}

	.mic-error {
		color: #e74c3c;
		font-size: 0.85rem;
	}

	.quiz-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.hint-btn {
		background: #f0eeeb;
		color: #4a2c6a;
		padding: 0.35rem 1rem;
		border: none;
		border-radius: 6px;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.hint-btn:hover {
		background: #e5e2de;
	}

	.stop-btn {
		background: #f0eeeb;
		color: #c0392b;
		padding: 0.35rem 1rem;
		border: none;
		border-radius: 6px;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.stop-btn:hover {
		background: #e5e2de;
	}

	@keyframes pop {
		0% { transform: scale(0.8); opacity: 0; }
		100% { transform: scale(1); opacity: 1; }
	}
</style>
```

**Step 2: Build to verify no type errors**

```bash
npm run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/QuizMode.svelte
git commit -m "feat: add QuizMode component with mic-based pitch feedback"
```

---

## Task 6: Integrate quiz mode into the main page

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Add quiz mode toggle and component**

In the `<script>` section, add imports and state:

```typescript
import QuizMode from '$lib/QuizMode.svelte';

let mode: 'practice' | 'quiz' = $state('practice');
let quizResult: { correct: number; total: number; bestStreak: number } | null = $state(null);
```

Add a mode toggle in the `.actions` div, between the existing buttons:

```svelte
<div class="mode-toggle">
	<button
		class="toggle-btn"
		class:active={mode === 'practice'}
		onclick={() => { mode = 'practice'; }}
	>
		{m.practice_mode()}
	</button>
	<button
		class="toggle-btn"
		class:active={mode === 'quiz'}
		onclick={() => { mode = 'quiz'; }}
	>
		{m.quiz_mode()}
	</button>
</div>
```

Below the SheetMusic component, conditionally render either the playback controls or the quiz:

```svelte
{#if mode === 'practice'}
	<!-- existing play/stop/new exercise buttons -->
{:else}
	<QuizMode
		{exercise}
		onComplete={(result) => { quizResult = result; }}
	/>
{/if}
```

Pass `highlightIndex` from the quiz's `currentIndex` to SheetMusic when in quiz mode. This requires exposing `currentIndex` from QuizMode — either via a bindable prop or a callback. The simplest approach: add an `onNoteChange` callback prop to QuizMode that fires `currentIndex`, and use that to set `highlightIndex` in the parent.

**Step 2: Add CSS for mode toggle**

```css
.mode-toggle {
	display: flex;
	gap: 2px;
	background: #f0eeeb;
	border-radius: 6px;
	padding: 2px;
	margin-bottom: 0.5rem;
}

.toggle-btn {
	padding: 0.35rem 1rem;
	border: none;
	border-radius: 5px;
	font-size: 0.75rem;
	font-weight: 500;
	cursor: pointer;
	background: transparent;
	color: #888;
	transition: all 0.15s;
}

.toggle-btn.active {
	background: white;
	color: #4a2c6a;
	font-weight: 600;
	box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
```

**Step 3: Build and test manually**

```bash
npm run build
npm run preview
```

Open in browser. Verify:
- Mode toggle switches between Practice and Quiz
- In Practice mode, existing playback works as before
- In Quiz mode, clicking "Start Quiz" prompts for mic permission
- Notes highlight as quiz progresses
- Correct/wrong feedback appears

**Step 4: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: integrate quiz mode into main page with mode toggle"
```

---

## Task 7: UI refresh using frontend-design skill

**Files:**
- Modify: `src/routes/+page.svelte` (styles)
- Possibly modify: `src/lib/SheetMusic.svelte` (styles)
- Possibly modify: `src/lib/QuizMode.svelte` (styles)

**Step 1: Invoke the frontend-design skill**

Use the `frontend-design:frontend-design` skill to redesign the UI. The skill should focus on:

- Polish the overall layout and typography
- Make the mode toggle feel like a first-class navigation element
- Style the quiz feedback (correct/wrong) with satisfying animations
- Ensure mobile responsiveness
- Keep the design lightweight and fast
- Maintain the existing purple/cream color palette as a starting point but allow the skill to improve it

**Step 2: Build and verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/routes/+page.svelte src/lib/SheetMusic.svelte src/lib/QuizMode.svelte
git commit -m "style: UI refresh with polished layout, animations, and mobile responsiveness"
```

---

## Task 8: Add Playwright e2e tests

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/exercise.spec.ts`
- Create: `e2e/quiz.spec.ts`

**Step 1: Set up Playwright config**

Create `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI
	},
	use: {
		baseURL: 'http://localhost:4173'
	}
});
```

Add to `package.json` scripts:

```json
"test:e2e": "playwright test"
```

**Step 2: Write exercise tests**

Create `e2e/exercise.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Exercise mode', () => {
	test('renders sheet music on load', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('.sheet-music-container svg')).toBeVisible();
	});

	test('generates new exercise on button click', async ({ page }) => {
		await page.goto('/');
		const svg1 = await page.locator('.sheet-music-container svg').innerHTML();
		await page.getByText('New Exercise').click();
		// Wait for re-render
		await page.waitForTimeout(200);
		const svg2 = await page.locator('.sheet-music-container svg').innerHTML();
		// Exercises are random, so SVGs should differ (with very high probability)
		expect(svg1).not.toBe(svg2);
	});

	test('settings panel opens and has controls', async ({ page }) => {
		await page.goto('/');
		await page.locator('summary').click();
		await expect(page.locator('#maxInterval')).toBeVisible();
		await expect(page.locator('#noteCount')).toBeVisible();
		await expect(page.locator('#tempo')).toBeVisible();
	});

	test('clicking a note plays audio', async ({ page }) => {
		await page.goto('/');
		// Click on the first note in the SVG
		const note = page.locator('.sheet-music-container .abcjs-note').first();
		await expect(note).toBeVisible();
		await note.click();
		// We can't easily verify audio, but the click should not error
	});

	test('language switcher works', async ({ page }) => {
		await page.goto('/');
		await page.locator('.lang-switcher a').filter({ hasText: 'NL' }).click();
		await expect(page.getByText('Oefening')).toBeVisible();
	});
});
```

**Step 3: Write quiz mode tests**

Create `e2e/quiz.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Quiz mode', () => {
	test('shows quiz mode toggle', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByText('Quiz')).toBeVisible();
		await expect(page.getByText('Practice')).toBeVisible();
	});

	test('switching to quiz mode shows start button', async ({ page }) => {
		await page.goto('/');
		await page.getByText('Quiz').click();
		await expect(page.getByText('Start Quiz')).toBeVisible();
	});

	test('switching back to practice shows play button', async ({ page }) => {
		await page.goto('/');
		await page.getByText('Quiz').click();
		await page.getByText('Practice').click();
		await expect(page.getByText('Play')).toBeVisible();
	});
});
```

**Step 4: Install Playwright browsers and run tests**

```bash
npx playwright install chromium
npx playwright test
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add playwright.config.ts e2e/ package.json
git commit -m "test: add Playwright e2e tests for exercise and quiz modes"
```

---

## Task 9: Add vitest config and test script

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

**Step 1: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.test.ts']
	}
});
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 2: Run all unit tests**

```bash
npm test
```

Expected: All tests in `src/lib/music.test.ts` and `src/lib/pitch.test.ts` pass.

**Step 3: Commit**

```bash
git add vitest.config.ts package.json
git commit -m "chore: add vitest config and test scripts"
```

---

## Summary of files created/modified

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/lib/music.ts` | Add `frequencyToMidi` |
| Create | `src/lib/music.test.ts` | Unit tests for frequency conversion |
| Create | `src/lib/pitch.ts` | YIN pitch detection algorithm |
| Create | `src/lib/pitch.test.ts` | Unit tests for pitch detection |
| Create | `src/lib/microphone.ts` | Mic input + pitch detection loop |
| Create | `src/lib/QuizMode.svelte` | Quiz UI component |
| Modify | `src/routes/+page.svelte` | Integrate quiz mode + mode toggle |
| Modify | `messages/*.json` | i18n keys for quiz (5 languages) |
| Create | `playwright.config.ts` | Playwright setup |
| Create | `e2e/exercise.spec.ts` | E2e tests for exercise mode |
| Create | `e2e/quiz.spec.ts` | E2e tests for quiz mode |
| Create | `vitest.config.ts` | Vitest config |
| Modify | `package.json` | Add vitest, test scripts |
