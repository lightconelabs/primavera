<script lang="ts">
	interface Props {
		offset: number;
		noteName: string;
		feedback: 'correct' | 'wrong' | null;
	}

	let { offset, noteName, feedback }: Props = $props();
</script>

<div class="gauge">
	<div class="gauge-bar">
		<div
			class="gauge-dot"
			class:tuned={Math.abs(offset) < 0.15}
			class:err={feedback === 'wrong'}
			style="left: {50 + offset * 45}%"
		></div>
		<div class="gauge-mid"></div>
	</div>
	<span class="gauge-note" class:correct={feedback === 'correct'} class:err={feedback === 'wrong'}>
		{noteName}
	</span>
</div>

<style>
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

	@media (max-width: 600px) {
		.gauge-note { font-size: 1.6rem; }
	}
</style>
