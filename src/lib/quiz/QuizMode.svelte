<script lang="ts">
	import { onDestroy } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import type { Exercise } from '$lib/music/model';
	import { QuizController } from './quizState.svelte';
	import TuningGauge from './TuningGauge.svelte';
	import QuizToolbar from './QuizToolbar.svelte';

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

	const quiz = new QuizController({
		getExercise: () => exercise,
		onComplete: (score) => onComplete(score),
		onNoteChange: (index) => onNoteChange(index),
		micUnsupportedMsg: m.quiz_mic_unsupported,
		micPermissionMsg: m.quiz_mic_permission
	});

	// Sync bindable active prop with controller state
	$effect(() => { active = quiz.active; });

	onDestroy(() => { quiz.destroy(); });

	export function startQuiz() { return quiz.start(); }
</script>

<div class="quiz-mode">
	{#if quiz.errorMessage}
		<p class="quiz-error">{quiz.errorMessage}</p>
	{/if}

	{#if !quiz.active && !quiz.completed}
		{#if showStartButton}
		<button class="start-btn" onclick={() => quiz.start()}>
			<svg class="start-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
			{m.quiz_start()}
		</button>
		{/if}
	{:else if quiz.active && !quiz.completed}
		<div class="quiz-live">
			<QuizToolbar
				score={quiz.score}
				total={quiz.totalNotes}
				streak={quiz.streak}
				onHear={() => quiz.hearCurrentNote()}
				onStop={() => quiz.stop()}
			/>
			<TuningGauge
				offset={quiz.gaugeOffset}
				noteName={quiz.currentNoteName}
				feedback={quiz.feedback}
			/>
		</div>
	{:else if quiz.completed}
		<div class="done">
			<span class="done-score">{quiz.score}<span class="dim">/</span>{quiz.totalNotes}</span>
			<p class="done-msg">{m.quiz_complete()}</p>
			{#if showStartButton}
				<button class="start-btn" onclick={() => quiz.start()}>{m.quiz_start()}</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.quiz-mode {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		padding: 0.75rem 1rem 1rem;
		box-sizing: border-box;
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

	.start-btn:hover { background: rgba(58, 122, 76, 0.12); }
	.start-btn:active { transform: scale(0.97); }
	.start-icon { width: 15px; height: 15px; }

	.quiz-live, .done {
		width: 100%;
		max-width: 24rem;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.dim { opacity: 0.3; font-weight: 400; }

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

	@media (max-width: 600px) {
		.quiz-mode { padding: 0.5rem 0.75rem 0.75rem; }
		.quiz-live, .done { max-width: none; }
		.start-btn { max-width: none; }
	}
</style>
