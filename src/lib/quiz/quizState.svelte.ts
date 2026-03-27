/**
 * Reactive state controller for the quiz feature.
 * Manages scoring, pitch evaluation, mic lifecycle, and note progression.
 */

import type { Exercise } from '$lib/music/model';
import type { PitchResult } from '$lib/audio/microphone';
import { playNote } from '$lib/audio/audio';
import { startListening, stopListening, pauseListening, resumeListening, isMicSupported } from '$lib/audio/microphone';
import { isNoteMatch, computeGaugeOffset, GaugeSmoother, StabilityDetector } from './quizEngine';

export type Feedback = 'correct' | 'wrong' | null;

export class QuizController {
	// Public reactive state (read by the component template)
	currentIndex = $state(0);
	score = $state(0);
	streak = $state(0);
	bestStreak = $state(0);
	feedback = $state<Feedback>(null);
	errorMessage = $state<string | null>(null);
	completed = $state(false);
	active = $state(false);
	gaugeOffset = $state(0);

	// Callbacks set by the component
	private onComplete: (score: number) => void;
	private onNoteChange: (index: number) => void;
	private getExercise: () => Exercise;
	private micUnsupportedMsg: () => string;
	private micPermissionMsg: () => string;

	// Internal non-reactive state
	private sessionId = 0;
	private processingUntil = 0;
	private advanceTimeoutId: ReturnType<typeof setTimeout> | null = null;
	private resumeTimeoutId: ReturnType<typeof setTimeout> | null = null;
	private gauge = new GaugeSmoother();
	private stability = new StabilityDetector();

	constructor(opts: {
		getExercise: () => Exercise;
		onComplete: (score: number) => void;
		onNoteChange: (index: number) => void;
		micUnsupportedMsg: () => string;
		micPermissionMsg: () => string;
	}) {
		this.getExercise = opts.getExercise;
		this.onComplete = opts.onComplete;
		this.onNoteChange = opts.onNoteChange;
		this.micUnsupportedMsg = opts.micUnsupportedMsg;
		this.micPermissionMsg = opts.micPermissionMsg;
	}

	get currentNoteName(): string {
		return this.getExercise().notes[this.currentIndex]?.name ?? '-';
	}

	get totalNotes(): number {
		return this.getExercise().notes.length;
	}

	async start(): Promise<void> {
		if (!isMicSupported()) {
			this.errorMessage = this.micUnsupportedMsg();
			return;
		}
		this.reset();
		try {
			await startListening((r) => this.onPitch(r));
			this.active = true;
			this.onNoteChange(0);
		} catch {
			this.errorMessage = this.micPermissionMsg();
		}
	}

	stop(): void {
		this.sessionId++;
		this.clearPendingTimeouts();
		stopListening();
		this.active = false;
		this.stability.reset();
		this.processingUntil = 0;
	}

	async hearCurrentNote(): Promise<void> {
		const note = this.getExercise().notes[this.currentIndex];
		if (!note) return;
		try {
			pauseListening();
			await playNote(note.midi, 0.8);
			await new Promise((r) => setTimeout(r, 200));
		} finally {
			resumeListening();
		}
	}

	destroy(): void {
		this.stop();
	}

	// --- Private ---

	private reset(): void {
		this.currentIndex = 0;
		this.score = 0;
		this.streak = 0;
		this.bestStreak = 0;
		this.feedback = null;
		this.gaugeOffset = 0;
		this.errorMessage = null;
		this.completed = false;
		this.processingUntil = 0;
		this.gauge.reset();
		this.stability.reset();
		this.clearPendingTimeouts();
	}

	private clearPendingTimeouts(): void {
		if (this.advanceTimeoutId !== null) { clearTimeout(this.advanceTimeoutId); this.advanceTimeoutId = null; }
		if (this.resumeTimeoutId !== null) { clearTimeout(this.resumeTimeoutId); this.resumeTimeoutId = null; }
	}

	private onPitch(result: PitchResult): void {
		if (!this.active || this.completed) return;

		const { midi, exactMidi, frequency } = result;
		if (midi === null || exactMidi === null || frequency === null) {
			this.stability.reset();
			return;
		}

		const expected = this.getExercise().notes[this.currentIndex];
		if (expected) {
			const raw = computeGaugeOffset(exactMidi, frequency, expected.midi);
			this.gaugeOffset = this.gauge.push(raw);
		}

		if (Date.now() < this.processingUntil) return;

		if (this.stability.push(midi)) {
			this.evaluateNote(midi);
		}
	}

	private evaluateNote(detectedMidi: number): void {
		if (Date.now() < this.processingUntil || this.completed) return;

		const exercise = this.getExercise();
		const expected = exercise.notes[this.currentIndex];
		if (!expected) return;
		const session = this.sessionId;

		if (isNoteMatch(detectedMidi, expected.midi)) {
			this.feedback = 'correct';
			this.gaugeOffset = 0;
			this.gauge.reset();
			this.score++;
			this.streak++;
			if (this.streak > this.bestStreak) this.bestStreak = this.streak;

			this.processingUntil = Date.now() + 800;
			this.advanceTimeoutId = setTimeout(() => {
				if (session !== this.sessionId) return;
				const nextIndex = this.currentIndex + 1;
				if (nextIndex >= exercise.notes.length) {
					this.completed = true;
					this.feedback = null;
					this.stop();
					this.onComplete(this.score);
				} else {
					this.currentIndex = nextIndex;
					this.onNoteChange(nextIndex);
					this.feedback = null;
					this.gaugeOffset = 0;
					this.gauge.reset();
				}
				this.advanceTimeoutId = null;
			}, 700);
		} else {
			this.feedback = 'wrong';
			this.streak = 0;

			this.processingUntil = Date.now() + 1500;
			pauseListening();
			playNote(expected.midi, 0.8).finally(() => {
				if (session !== this.sessionId) return;
				this.resumeTimeoutId = setTimeout(() => {
					if (session !== this.sessionId) return;
					resumeListening();
					this.feedback = null;
					this.resumeTimeoutId = null;
				}, 400);
			});
		}
	}
}
