<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { Exercise } from '$lib/music/model';
	import SheetMusic from '$lib/components/SheetMusic.svelte';
	import QuizMode from '$lib/quiz/QuizMode.svelte';

	interface Props {
		exercise: Exercise;
		mode: 'practice' | 'quiz';
		highlightIndex: number;
		isPlaying: boolean;
		onModeChange: (mode: 'practice' | 'quiz') => void;
		onGenerate: () => void;
		onPlay: () => void;
		onStopPlayback: () => void;
		onQuizNoteClick?: (noteIndex: number) => Promise<void>;
		onQuizNoteChange: (index: number) => void;
	}

	let {
		exercise,
		mode,
		highlightIndex,
		isPlaying,
		onModeChange,
		onGenerate,
		onPlay,
		onStopPlayback,
		onQuizNoteClick,
		onQuizNoteChange
	}: Props = $props();

	let quizModeRef = $state<{ startQuiz: () => Promise<void> } | null>(null);
	let quizActive = $state(false);
</script>

<section class="sheet-music">
	<div class="mode-toggle" role="tablist">
		<button
			class="toggle-btn"
			class:active={mode === 'practice'}
			role="tab"
			aria-selected={mode === 'practice'}
			onclick={() => onModeChange('practice')}
		>
			<span class="toggle-icon">&#9835;</span>
			{m.practice_mode()}
		</button>

		<button
			class="toggle-btn"
			class:active={mode === 'quiz'}
			role="tab"
			aria-selected={mode === 'quiz'}
			onclick={() => onModeChange('quiz')}
		>
			<span class="toggle-icon">&#9834;</span>
			{m.quiz_mode()}
		</button>

		<div class="toggle-slider" class:right={mode === 'quiz'}></div>
	</div>

	<div class="sheet-scroll">
		<SheetMusic
			{exercise}
			{highlightIndex}
			onNoteClick={mode === 'quiz' ? onQuizNoteClick : undefined}
		/>
	</div>

	{#if mode === 'quiz'}
		<p class="mode-hint">{@html m.footer_hint_quiz()}</p>
	{:else}
		<p class="mode-hint">{@html m.footer_hint()}</p>
	{/if}

	<div class="action-bar">
		<button class="btn primary" onclick={onGenerate}>
			{m.new_exercise()}
		</button>

		{#if mode === 'practice'}
			{#if isPlaying}
				<button class="btn danger" onclick={onStopPlayback}>
					{m.stop()}
				</button>
			{:else}
				<button class="btn secondary" onclick={onPlay}>
					&#9654; {m.play()}
				</button>
			{/if}
		{:else if !quizActive}
			<button class="btn secondary" onclick={() => quizModeRef?.startQuiz()}>
				<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
				{m.quiz_start()}
			</button>
		{/if}
	</div>

	{#if mode === 'quiz'}
		{#key exercise}
			<QuizMode
				bind:this={quizModeRef}
				bind:active={quizActive}
				{exercise}
				showStartButton={false}
				onComplete={() => {}}
				onNoteChange={onQuizNoteChange}
			/>
		{/key}
	{/if}
</section>

<style>
	.sheet-music {
		background: #fff;
		border: 1px solid #e8e0d4;
		border-radius: 16px;
		padding: 0;
		margin-bottom: 1rem;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(58, 122, 76, 0.04), 0 4px 16px rgba(58, 122, 76, 0.03);
	}

	.sheet-scroll {
		display: flex;
		justify-content: center;
		padding: 1.25rem 1.25rem 0.75rem;
		overflow-x: auto;
	}

	.mode-toggle {
		display: flex;
		position: relative;
		margin: 0.75rem auto 0;
		background: rgba(58, 122, 76, 0.05);
		border-radius: 10px;
		padding: 4px;
		width: fit-content;
		gap: 0;
	}

	.toggle-btn {
		flex: 1 1 0;
		position: relative;
		z-index: 1;
		min-width: 8.5rem;
		padding: 0.5rem 1.35rem;
		border: none;
		background: transparent;
		font-family: 'DM Sans', sans-serif;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		color: #7a9a82;
		transition: color 0.25s;
		border-radius: 8px;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		white-space: nowrap;
	}

	.toggle-icon {
		font-size: 0.95rem;
		line-height: 1;
	}

	.toggle-btn.active {
		color: #3a7a4c;
		font-weight: 600;
	}

	.toggle-slider {
		position: absolute;
		top: 4px;
		left: 4px;
		width: calc(50% - 4px);
		height: calc(100% - 8px);
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 1px 4px rgba(58, 122, 76, 0.1);
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		pointer-events: none;
	}

	.toggle-slider.right {
		transform: translateX(100%);
	}

	.mode-hint {
		text-align: center;
		font-size: 0.75rem;
		color: #b0a496;
		margin: 0;
		padding: 0.15rem 1.25rem 0.5rem;
	}

	.action-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		justify-content: center;
		height: 4.75rem;
		padding: 0.75rem 1.25rem 1rem;
		box-sizing: border-box;
		border-top: 1px solid #f0ebe3;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 11rem;
		height: 2.25rem;
		padding: 0 1.3rem;
		border: none;
		border-radius: 8px;
		font-family: 'DM Sans', sans-serif;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		letter-spacing: 0.01em;
		gap: 0.35rem;
	}

	.btn:active {
		transform: scale(0.97);
	}

	.btn :global(svg.btn-icon) {
		width: 1em;
		height: 1em;
		flex-shrink: 0;
	}

	.btn.primary {
		background: #3a7a4c;
		color: #fff;
	}

	.btn.primary:hover {
		background: #468f58;
		box-shadow: 0 2px 8px rgba(58, 122, 76, 0.2);
	}

	.btn.secondary {
		background: rgba(58, 122, 76, 0.07);
		color: #3a7a4c;
	}

	.btn.secondary:hover {
		background: rgba(58, 122, 76, 0.12);
	}

	.btn.danger {
		background: rgba(192, 57, 43, 0.08);
		color: #b33326;
	}

	.btn.danger:hover {
		background: rgba(192, 57, 43, 0.14);
	}

	@media (max-width: 600px) {
		.sheet-music {
			border-radius: 12px;
		}

		.sheet-scroll {
			padding: 1rem 0.75rem 0.5rem;
		}

		.mode-toggle {
			margin: 0.5rem auto 0;
		}

		.toggle-btn {
			padding: 0.4rem 0.9rem;
			font-size: 0.75rem;
		}

		.action-bar {
			height: auto;
			min-height: 4.75rem;
			padding: 0.65rem 0.75rem 0.85rem;
			flex-wrap: wrap;
		}

		.btn {
			text-align: center;
		}
	}

	@media (max-width: 380px) {
		.toggle-icon {
			display: none;
		}
	}
</style>
