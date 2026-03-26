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
		<div class="quiz-idle">
			<button class="quiz-btn quiz-start" onclick={start}>
				<span class="mic-icon">&#9835;</span>
				{m.quiz_start()}
			</button>
		</div>
	{:else if active && !completed}
		<div class="quiz-active">
			<div class="listening-badge">
				<span class="pulse-dot"></span>
				<span class="listening-text">{m.quiz_listen()}</span>
			</div>

			<div class="quiz-stats">
				<div class="stat-pill">
					<span class="stat-value">{score}<span class="stat-sep">/</span>{exercise.notes.length}</span>
				</div>
				<div class="stat-pill streak">
					<span class="stat-value">{streak}</span>
				</div>
				<div class="stat-pill best">
					<span class="stat-value">{bestStreak}</span>
				</div>
			</div>

			<div class="feedback-zone">
				{#if feedback === 'correct'}
					<p class="quiz-feedback correct">{m.quiz_correct()}</p>
				{:else if feedback === 'wrong'}
					<p class="quiz-feedback wrong">{m.quiz_wrong()}</p>
				{:else}
					<p class="quiz-feedback placeholder">&nbsp;</p>
				{/if}
			</div>

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
			<div class="complete-badge">
				<span class="complete-check">&#10003;</span>
			</div>
			<p class="quiz-complete-msg">{m.quiz_complete()}</p>
			<div class="quiz-stats">
				<div class="stat-pill">
					<span class="stat-value">{score}<span class="stat-sep">/</span>{exercise.notes.length}</span>
				</div>
				<div class="stat-pill best">
					<span class="stat-value">{bestStreak}</span>
				</div>
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
		gap: 0.5rem;
		padding: 0.75rem 1rem 1rem;
	}

	.quiz-error {
		color: #b33326;
		font-size: 0.85rem;
		font-weight: 500;
		background: rgba(179, 51, 38, 0.06);
		padding: 0.5rem 0.85rem;
		border-radius: 8px;
	}

	.quiz-idle {
		padding: 0.5rem 0;
	}

	.quiz-active,
	.quiz-complete {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
	}

	/* ---- Listening badge ---- */

	.listening-badge {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.3rem 0.75rem;
		background: rgba(58, 122, 76, 0.06);
		border-radius: 20px;
	}

	.pulse-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #d4849a;
		animation: pulse 1.8s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.4; transform: scale(0.85); }
		50% { opacity: 1; transform: scale(1.15); }
	}

	.listening-text {
		font-size: 0.78rem;
		font-weight: 600;
		color: #3a7a4c;
		letter-spacing: 0.03em;
	}

	/* ---- Stats pills ---- */

	.quiz-stats {
		display: flex;
		gap: 0.5rem;
	}

	.stat-pill {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.65rem;
		background: rgba(58, 122, 76, 0.05);
		border-radius: 8px;
	}

	.stat-value {
		font-size: 0.85rem;
		font-weight: 700;
		color: #3a7a4c;
	}

	.stat-sep {
		opacity: 0.35;
		font-weight: 400;
		margin: 0 0.05rem;
	}

	.stat-pill.streak {
		background: rgba(212, 132, 154, 0.08);
	}

	.stat-pill.streak .stat-value {
		color: #d4849a;
	}

	.stat-pill.best {
		background: rgba(180, 142, 58, 0.08);
	}

	.stat-pill.best .stat-value {
		color: #a08030;
	}

	/* ---- Feedback zone ---- */

	.feedback-zone {
		min-height: 2.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.quiz-feedback {
		font-family: 'DM Serif Display', Georgia, serif;
		font-size: 1.4rem;
		font-weight: 400;
		margin: 0;
		line-height: 1;
	}

	.quiz-feedback.placeholder {
		visibility: hidden;
	}

	.quiz-feedback.correct {
		color: #2d8a4e;
		animation: pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.quiz-feedback.wrong {
		color: #b33326;
		animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
	}

	@keyframes pop-in {
		0% { opacity: 0; transform: scale(0.6); }
		60% { opacity: 1; transform: scale(1.12); }
		100% { transform: scale(1); }
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		15% { transform: translateX(-6px); }
		30% { transform: translateX(5px); }
		45% { transform: translateX(-4px); }
		60% { transform: translateX(3px); }
		75% { transform: translateX(-2px); }
	}

	.quiz-detected {
		font-size: 0.8rem;
		color: #9a8e82;
		margin: 0;
	}

	/* ---- Complete state ---- */

	.complete-badge {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: linear-gradient(135deg, #2d8a4e 0%, #3aaf62 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		animation: pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.complete-check {
		color: #fff;
		font-size: 1.2rem;
		font-weight: 700;
	}

	.quiz-complete-msg {
		font-family: 'DM Serif Display', Georgia, serif;
		font-size: 1.2rem;
		font-weight: 400;
		color: #2d8a4e;
		margin: 0;
	}

	/* ---- Actions & buttons ---- */

	.quiz-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.quiz-btn {
		padding: 0.5rem 1.2rem;
		border: none;
		border-radius: 8px;
		font-family: 'DM Sans', sans-serif;
		font-size: 0.82rem;
		cursor: pointer;
		font-weight: 600;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		letter-spacing: 0.01em;
	}

	.quiz-btn:active {
		transform: scale(0.97);
	}

	.quiz-start {
		background: #3a7a4c;
		color: #fff;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.quiz-start:hover {
		background: #468f58;
		box-shadow: 0 2px 10px rgba(58, 122, 76, 0.2);
	}

	.mic-icon {
		font-size: 1rem;
	}

	.quiz-stop {
		background: rgba(179, 51, 38, 0.08);
		color: #b33326;
	}

	.quiz-stop:hover {
		background: rgba(179, 51, 38, 0.14);
	}

	.quiz-hear {
		background: rgba(58, 122, 76, 0.07);
		color: #3a7a4c;
	}

	.quiz-hear:hover {
		background: rgba(58, 122, 76, 0.12);
	}

	/* ---- Responsive ---- */

	@media (max-width: 600px) {
		.quiz-mode {
			padding: 0.5rem 0.75rem 0.75rem;
		}

		.quiz-stats {
			flex-wrap: wrap;
			justify-content: center;
		}

		.quiz-feedback {
			font-size: 1.2rem;
		}

		.quiz-actions {
			width: 100%;
		}

		.quiz-actions .quiz-btn {
			flex: 1;
			justify-content: center;
			text-align: center;
		}
	}
</style>
