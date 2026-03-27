<script lang="ts">
	import { onDestroy } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import type { Exercise, NoteName } from './music';
	import { NOTE_NAMES, midiToFrequency } from './music';
	import { playNote } from './audio';
	import { startListening, stopListening, pauseListening, resumeListening, isMicSupported } from './microphone';
	import type { PitchResult } from './microphone';

	interface Props {
		exercise: Exercise;
		onComplete: (score: number) => void;
		onNoteChange: (index: number) => void;
		active?: boolean;
		showStartButton?: boolean;
	}

	let {
		exercise,
		onComplete,
		onNoteChange,
		active = $bindable(false),
		showStartButton = true
	}: Props = $props();

	const CHROMATIC_TO_NAME: NoteName[] = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
	let advanceTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let resumeTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let sessionId = 0;

	function midiToNoteName(midi: number): NoteName {
		const index = ((midi % 12) + 12) % 12;
		return CHROMATIC_TO_NAME[index];
	}

	function pitchClass(midi: number): number {
		return ((midi % 12) + 12) % 12;
	}

	function isNoteMatch(detectedMidi: number, expectedMidi: number): boolean {
		return pitchClass(detectedMidi) === pitchClass(expectedMidi);
	}

	function clearPendingTimeouts() {
		if (advanceTimeoutId !== null) {
			clearTimeout(advanceTimeoutId);
			advanceTimeoutId = null;
		}
		if (resumeTimeoutId !== null) {
			clearTimeout(resumeTimeoutId);
			resumeTimeoutId = null;
		}
	}

	// Quiz state
	let currentIndex = $state(0);
	let score = $state(0);
	let streak = $state(0);
	let bestStreak = $state(0);
	let feedback = $state<'correct' | 'wrong' | null>(null);
	let detectedNoteName = $state<string | null>(null);
	let centsDeviation = $state<number | null>(null);
	let errorMessage = $state<string | null>(null);
	let completed = $state(false);

	// Tuning gauge: how far from the expected note (-50 to +50 cents, or wider)
	let gaugeOffset = $state(0); // -1 to 1 range for the visual gauge

	// Stability tracking: require same MIDI for 5 consecutive frames
	const STABILITY_THRESHOLD = 5;
	let stableCount = 0;
	let lastMidi: number | null = null;
	// Use a timestamp instead of a boolean flag — can't get stuck
	let processingUntil = 0;

	// Rolling window for gauge smoothing
	const GAUGE_WINDOW_SIZE = 12;
	let gaugeHistory: number[] = [];

	function resetState() {
		currentIndex = 0;
		score = 0;
		streak = 0;
		bestStreak = 0;
		feedback = null;
		detectedNoteName = null;
		centsDeviation = null;
		gaugeOffset = 0;
		gaugeHistory = [];
		errorMessage = null;
		completed = false;
		stableCount = 0;
		lastMidi = null;
		processingUntil = 0;
		clearPendingTimeouts();
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
		sessionId++;
		clearPendingTimeouts();
		stopListening();
		active = false;
		stableCount = 0;
		lastMidi = null;
		processingUntil = 0;
	}

	function onPitch(result: PitchResult) {
		if (!active || completed) return;

		const { midi, exactMidi, cents, frequency } = result;
		if (midi === null || exactMidi === null || frequency === null) {
			stableCount = 0;
			lastMidi = null;
			return;
		}

		// Always update the gauge, even during processing
		detectedNoteName = midiToNoteName(midi);
		centsDeviation = cents;

		const expected = exercise.notes[currentIndex];
		if (expected) {
			// Find the closest octave of the expected note to what was sung
			const octaveShift = Math.round((exactMidi - expected.midi) / 12) * 12;
			const nearestExpectedFreq = midiToFrequency(expected.midi + octaveShift);
			const centsFromExpected = 1200 * Math.log2(frequency / nearestExpectedFreq);
			const raw = Math.max(-1, Math.min(1, centsFromExpected / 100));

			// Rolling average over last N frames for a steady needle
			gaugeHistory.push(raw);
			if (gaugeHistory.length > GAUGE_WINDOW_SIZE) gaugeHistory.shift();
			const avg = gaugeHistory.reduce((a, b) => a + b, 0) / gaugeHistory.length;
			gaugeOffset = avg;
		}

		// Don't evaluate while processing feedback (auto-expires)
		if (Date.now() < processingUntil) return;

		if (midi === lastMidi) {
			stableCount++;
		} else {
			lastMidi = midi;
			stableCount = 1;
		}

		if (stableCount >= STABILITY_THRESHOLD) {
			stableCount = 0;
			lastMidi = null;
			evaluateNote(midi);
		}
	}

	function evaluateNote(detectedMidi: number) {
		if (Date.now() < processingUntil || completed) return;

		const expected = exercise.notes[currentIndex];
		if (!expected) return;
		const currentSession = sessionId;

		if (isNoteMatch(detectedMidi, expected.midi)) {
			feedback = 'correct';
			gaugeOffset = 0;
			gaugeHistory = [];
			score++;
			streak++;
			if (streak > bestStreak) bestStreak = streak;

			// Block evaluation for 800ms, then advance
			processingUntil = Date.now() + 800;
			advanceTimeoutId = setTimeout(() => {
				if (currentSession !== sessionId) return;
				const nextIndex = currentIndex + 1;
				if (nextIndex >= exercise.notes.length) {
					completed = true;
					feedback = null;
					stop();
					onComplete(score);
				} else {
					currentIndex = nextIndex;
					onNoteChange(nextIndex);
					feedback = null;
					gaugeOffset = 0;
					gaugeHistory = [];
					centsDeviation = null;
					detectedNoteName = null;
				}
				advanceTimeoutId = null;
			}, 700);
		} else {
			feedback = 'wrong';
			streak = 0;

			// Block evaluation for 1.5s, play correct note
			processingUntil = Date.now() + 1500;
			pauseListening();
			playNote(expected.midi, 0.8).finally(() => {
				if (currentSession !== sessionId) return;
				resumeTimeoutId = setTimeout(() => {
					if (currentSession !== sessionId) return;
					resumeListening();
					feedback = null;
					resumeTimeoutId = null;
				}, 400);
			});
		}
	}

	function delay(ms: number): Promise<void> {
		return new Promise((r) => setTimeout(r, ms));
	}

	async function hearCurrentNote() {
		const note = exercise.notes[currentIndex];
		if (note) {
			try {
				pauseListening();
				await playNote(note.midi, 0.8);
				await delay(200);
			} finally {
				resumeListening();
			}
		}
	}

	onDestroy(() => {
		stop();
	});

	export function startQuiz() {
		return start();
	}
</script>

<div class="quiz-mode">
	{#if errorMessage}
		<p class="quiz-error">{errorMessage}</p>
	{/if}

	{#if !active && !completed}
		{#if showStartButton}
		<button class="start-btn" onclick={start}>
			<svg class="start-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
			{m.quiz_start()}
		</button>
		{/if}
	{:else if active && !completed}
		<div class="quiz-live">
			<div class="topbar">
				<span class="progress">{score}<span class="dim">/</span>{exercise.notes.length}</span>
				{#if streak > 1}<span class="streak">{streak}x</span>{/if}
				<span class="spacer"></span>
				<button class="icon-btn" onclick={hearCurrentNote} title={m.quiz_hear_note()}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
				</button>
				<button class="icon-btn danger" onclick={stop} title={m.quiz_stop()}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
				</button>
			</div>
			<div class="gauge">
				<div class="gauge-bar">
					<div class="gauge-dot" class:tuned={Math.abs(gaugeOffset) < 0.15} class:err={feedback === 'wrong'} style="left: {50 + gaugeOffset * 45}%"></div>
					<div class="gauge-mid"></div>
				</div>
				<span class="gauge-note" class:correct={feedback === 'correct'} class:err={feedback === 'wrong'}>
					{exercise.notes[currentIndex]?.name ?? '-'}
				</span>
			</div>
		</div>
	{:else if completed}
		<div class="done">
			<span class="done-score">{score}<span class="dim">/</span>{exercise.notes.length}</span>
			<p class="done-msg">{m.quiz_complete()}</p>
			{#if showStartButton}
				<button class="start-btn" onclick={start}>{m.quiz_start()}</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.quiz-mode {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		padding: 0.75rem 1rem 1rem;
	}

	.quiz-mode:not(:has(*)) {
		padding: 0;
	}

	.quiz-error {
		color: #b33326;
		font-size: 0.8rem;
		background: rgba(179, 51, 38, 0.06);
		padding: 0.4rem 0.75rem;
		border-radius: 8px;
		margin-bottom: 0.5rem;
	}

	/* ---- Start / restart button ---- */
	/* Matches .btn.secondary from the main page */

	.start-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		width: 100%;
		max-width: 11rem;
		padding: 0.5rem 1.3rem;
		border: none;
		border-radius: 8px;
		background: rgba(58, 122, 76, 0.07);
		color: #3a7a4c;
		font-family: 'DM Sans', sans-serif;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.start-btn:hover {
		background: rgba(58, 122, 76, 0.12);
	}

	.start-btn:active { transform: scale(0.97); }

	.start-icon { width: 15px; height: 15px; }

	/* ---- Live quiz ---- */

	.quiz-live, .done {
		flex-basis: 100%;
		max-width: 300px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	/* ---- Top bar ---- */

	.topbar {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.progress {
		font-size: 0.8rem;
		font-weight: 700;
		color: #2d2a26;
	}

	.dim { opacity: 0.3; font-weight: 400; }

	.streak {
		font-size: 0.68rem;
		font-weight: 700;
		color: #d4849a;
		background: rgba(212, 132, 154, 0.1);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
	}

	.spacer { flex: 1; }

	.icon-btn {
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		border: 1px solid #e8e0d4;
		border-radius: 6px;
		background: transparent;
		color: #3a7a4c;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}

	.icon-btn:hover {
		background: rgba(58, 122, 76, 0.06);
		border-color: #c4b8aa;
	}

	.icon-btn:active { transform: scale(0.95); }

	.icon-btn svg { width: 14px; height: 14px; }

	.icon-btn.danger { color: #b33326; }
	.icon-btn.danger:hover { background: rgba(179, 51, 38, 0.06); }

	/* ---- Gauge ---- */

	.gauge {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.gauge-bar {
		position: relative;
		width: 100%;
		height: 4px;
		border-radius: 2px;
		background: #e8e0d4;
	}

	.gauge-mid {
		position: absolute;
		left: 50%;
		top: -3px;
		width: 2px;
		height: 10px;
		background: #3a7a4c;
		opacity: 0.4;
		transform: translateX(-50%);
		border-radius: 1px;
	}

	.gauge-dot {
		position: absolute;
		top: 50%;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #9a8e82;
		border: 2px solid #fff;
		box-shadow: 0 1px 4px rgba(0,0,0,0.12);
		transform: translate(-50%, -50%);
		transition: left 0.2s ease-out, background 0.15s;
	}

	.gauge-dot.tuned { background: #3a7a4c; }
	.gauge-dot.err { background: #b33326; }

	.gauge-note {
		font-family: 'DM Serif Display', Georgia, serif;
		font-size: 2rem;
		line-height: 1;
		color: #2d2a26;
		transition: color 0.15s;
	}

	.gauge-note.correct { color: #3a7a4c; }
	.gauge-note.err { color: #b33326; }

	/* ---- Done ---- */

	.done-score {
		font-family: 'DM Serif Display', Georgia, serif;
		font-size: 1.6rem;
		color: #3a7a4c;
	}

	.done-msg {
		font-size: 0.8rem;
		color: #9a8e82;
		margin: 0;
	}

	/* ---- Responsive ---- */

	@media (max-width: 600px) {
		.quiz-mode { padding: 0.5rem 0.75rem 0.75rem; }
		.quiz-live, .done { max-width: none; }
		.start-btn { max-width: none; }
		.gauge-note { font-size: 1.6rem; }
	}
</style>
