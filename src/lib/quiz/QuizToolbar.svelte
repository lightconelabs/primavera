<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		score: number;
		total: number;
		streak: number;
		onHear: () => void;
		onStop: () => void;
	}

	let { score, total, streak, onHear, onStop }: Props = $props();
</script>

<div class="topbar">
	<span class="progress">{score}<span class="dim">/</span>{total}</span>
	{#if streak > 1}<span class="streak">{streak}x</span>{/if}
	<span class="spacer"></span>
	<button class="icon-btn" onclick={onHear} title={m.quiz_hear_note()}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
	</button>
	<button class="icon-btn danger" onclick={onStop} title={m.quiz_stop()}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
	</button>
</div>

<style>
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
</style>
