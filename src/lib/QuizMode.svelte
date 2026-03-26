<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { Exercise, NoteName } from './music';
	import { NOTE_NAMES } from './music';
	import { playNote } from './audio';
	import { startListening, stopListening, isMicSupported } from './microphone';
	import type { PitchResult } from './microphone';

	interface Props {
		exercise: Exercise;
		onComplete: (score: number) => void;
		onNoteChange: (index: number) => void;
	}

	let { exercise, onComplete, onNoteChange }: Props = $props();

	/**
	 * Map MIDI note number to a diatonic note name (ignoring octave).
	 * Uses the chromatic scale: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
	 * We map sharps/flats to their natural neighbor for name-only comparison.
	 */
	const CHROMATIC_TO_NAME: NoteName[] = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];

	function midiToNoteName(midi: number): NoteName {
		const index = ((midi % 12) + 12) % 12;
		return CHROMATIC_TO_NAME[index];
	}

	// Quiz state
	let active = $state(false);
	let currentIndex = $state(0);
	let score = $state(0);
	let streak = $state(0);
	let bestStreak = $state(0);
	let feedback = $state<'correct' | 'wrong' | null>(null);
	let detectedNoteName = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let completed = $state(false);

	// Stability tracking: require same MIDI for 5 consecutive frames
	const STABILITY_THRESHOLD = 5;
	let stableCount = 0;
	let lastMidi: number | null = null;
	let processing = false;

	function resetState() {
		currentIndex = 0;
		score = 0;
		streak = 0;
		bestStreak = 0;
		feedback = null;
		detectedNoteName = null;
		errorMessage = null;
		completed = false;
		stableCount = 0;
		lastMidi = null;
		processing = false;
	}

	async function start() {
		if (!isMicSupported()) {
			errorMessage = m.quiz_mic_unsupported();
			return;
		}

		resetState();

		try {
			await startListening(onPitch);
			active = true;
			onNoteChange(0);
		} catch {
			errorMessage = m.quiz_mic_permission();
		}
	}

	function stop() {
		stopListening();
		active = false;
		stableCount = 0;
		lastMidi = null;
	}

	function onPitch(result: PitchResult) {
		if (!active || processing || completed) return;

		const { midi } = result;
		if (midi === null) {
			// No pitch detected, reset stability
			stableCount = 0;
			lastMidi = null;
			return;
		}

		if (midi === lastMidi) {
			stableCount++;
		} else {
			lastMidi = midi;
			stableCount = 1;
		}

		detectedNoteName = midiToNoteName(midi);

		if (stableCount >= STABILITY_THRESHOLD) {
			// Stable pitch detected, evaluate
			stableCount = 0;
			lastMidi = null;
			evaluateNote(midiToNoteName(midi));
		}
	}

	async function evaluateNote(detected: NoteName) {
		if (processing || completed) return;
		processing = true;

		const expected = exercise.notes[currentIndex];
		if (!expected) {
			processing = false;
			return;
		}

		if (detected === expected.name) {
			// Correct
			feedback = 'correct';
			score++;
			streak++;
			if (streak > bestStreak) bestStreak = streak;

			await pause(600);

			const nextIndex = currentIndex + 1;
			if (nextIndex >= exercise.notes.length) {
				// Quiz complete
				completed = true;
				feedback = null;
				stop();
				onComplete(score);
			} else {
				currentIndex = nextIndex;
				onNoteChange(nextIndex);
				feedback = null;
			}
		} else {
			// Wrong
			feedback = 'wrong';
			streak = 0;

			// Play the correct note so the student learns
			await playNote(expected.midi, 0.8);
			await pause(400);
			feedback = null;
		}

		processing = false;
	}

	function pause(ms: number): Promise<void> {
		return new Promise((r) => setTimeout(r, ms));
	}

	async function hearCurrentNote() {
		const note = exercise.notes[currentIndex];
		if (note) {
			await playNote(note.midi, 0.8);
		}
	}

	// Clean up on destroy
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		if (active) stop();
	});
</script>

<div class="quiz-mode">
	{#if errorMessage}
		<p class="quiz-error">{errorMessage}</p>
	{/if}

	{#if !active && !completed}
		<button class="quiz-btn quiz-start" onclick={start}>
			{m.quiz_start()}
		</button>
	{:else if active && !completed}
		<div class="quiz-active">
			<p class="quiz-instruction">{m.quiz_listen()}</p>

			<div class="quiz-stats">
				<span class="quiz-score">{m.quiz_score({ correct: String(score), total: String(exercise.notes.length) })}</span>
				<span class="quiz-streak">{m.quiz_streak({ count: String(streak) })}</span>
				<span class="quiz-best">{m.quiz_best_streak({ count: String(bestStreak) })}</span>
			</div>

			{#if feedback === 'correct'}
				<p class="quiz-feedback correct">{m.quiz_correct()}</p>
			{:else if feedback === 'wrong'}
				<p class="quiz-feedback wrong">{m.quiz_wrong()}</p>
			{/if}

			{#if detectedNoteName}
				<p class="quiz-detected">{m.quiz_detected_note({ note: detectedNoteName })}</p>
			{/if}

			<div class="quiz-actions">
				<button class="quiz-btn quiz-hear" onclick={hearCurrentNote}>
					{m.quiz_hear_note()}
				</button>
				<button class="quiz-btn quiz-stop" onclick={stop}>
					{m.quiz_stop()}
				</button>
			</div>
		</div>
	{:else if completed}
		<div class="quiz-complete">
			<p class="quiz-complete-msg">{m.quiz_complete()}</p>
			<div class="quiz-stats">
				<span class="quiz-score">{m.quiz_score({ correct: String(score), total: String(exercise.notes.length) })}</span>
				<span class="quiz-best">{m.quiz_best_streak({ count: String(bestStreak) })}</span>
			</div>
			<button class="quiz-btn quiz-start" onclick={start}>
				{m.quiz_start()}
			</button>
		</div>
	{/if}
</div>

<style>
	.quiz-mode {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
	}

	.quiz-error {
		color: var(--color-error, #d32f2f);
		font-weight: 500;
	}

	.quiz-active,
	.quiz-complete {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}

	.quiz-instruction {
		font-size: 1.1rem;
		font-weight: 500;
	}

	.quiz-stats {
		display: flex;
		gap: 1.5rem;
		font-size: 0.95rem;
	}

	.quiz-feedback {
		font-size: 1.3rem;
		font-weight: 700;
		min-height: 2rem;
	}

	.quiz-feedback.correct {
		color: var(--color-success, #2e7d32);
	}

	.quiz-feedback.wrong {
		color: var(--color-error, #d32f2f);
	}

	.quiz-detected {
		font-size: 0.9rem;
		opacity: 0.7;
	}

	.quiz-complete-msg {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--color-success, #2e7d32);
	}

	.quiz-actions {
		display: flex;
		gap: 0.75rem;
	}

	.quiz-btn {
		padding: 0.5rem 1.25rem;
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		cursor: pointer;
		font-weight: 500;
		transition: opacity 0.15s;
	}

	.quiz-btn:hover {
		opacity: 0.85;
	}

	.quiz-start {
		background: var(--color-primary, #1976d2);
		color: white;
	}

	.quiz-stop {
		background: var(--color-error, #d32f2f);
		color: white;
	}

	.quiz-hear {
		background: var(--color-secondary, #7b1fa2);
		color: white;
	}
</style>
