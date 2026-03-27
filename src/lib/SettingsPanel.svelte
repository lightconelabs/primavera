<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { ExerciseSettings } from '$lib/music';
	import { intervalLabels, keySignatureLabel } from '$lib/exerciseLabels';

	interface Props {
		settings: ExerciseSettings;
		onSetSharps: (value: number) => void;
		onSetFlats: (value: number) => void;
		onResetKey: () => void;
		onSettingsChange: () => void;
		onTempoChange: () => void;
	}

	let {
		settings,
		onSetSharps,
		onSetFlats,
		onResetKey,
		onSettingsChange,
		onTempoChange
	}: Props = $props();
</script>

<details class="controls">
	<summary>
		<span class="summary-content">
			<span class="summary-label">{m.settings()}</span>
			<span class="summary-values">
				{keySignatureLabel(settings.sharps, settings.flats)} &middot; {settings.noteCount} {m.notes()} &middot; {settings.tempo} {m.bpm()}
			</span>
		</span>
	</summary>

	<div class="controls-body">
		<div class="control-group">
			<!-- svelte-ignore a11y_label_has_associated_control -->
			<label>
				{m.key_label()}
				<span class="key-label">{keySignatureLabel(settings.sharps, settings.flats)}</span>
			</label>

			<div class="key-row">
				<span class="row-label">&#9837;</span>
				{#each [7, 6, 5, 4, 3, 2, 1] as n}
					<button class:active={settings.flats === n} onclick={() => onSetFlats(n)}>{n}</button>
				{/each}

				<button
					class="natural"
					class:active={settings.sharps === 0 && settings.flats === 0}
					onclick={onResetKey}
				>
					&#9838;
				</button>

				{#each [1, 2, 3, 4, 5, 6, 7] as n}
					<button class:active={settings.sharps === n} onclick={() => onSetSharps(n)}>{n}</button>
				{/each}
				<span class="row-label">&#9839;</span>
			</div>
		</div>

		<div class="control-group">
			<label for="maxInterval">
				{m.interval()}
				<span class="value">
					{intervalLabels[settings.maxInterval]?.() ?? `${settings.maxInterval} semitones`}
				</span>
			</label>
			<input
				id="maxInterval"
				type="range"
				min="1"
				max="12"
				bind:value={settings.maxInterval}
				onchange={onSettingsChange}
			/>
		</div>

		<div class="control-row">
			<div class="control-group">
				<label for="noteCount">
					{m.notes()} <span class="value">{settings.noteCount}</span>
				</label>
				<input
					id="noteCount"
					type="range"
					min="4"
					max="32"
					step="4"
					bind:value={settings.noteCount}
					onchange={onSettingsChange}
				/>
			</div>

			<div class="control-group">
				<label for="tempo">
					{m.tempo()} <span class="value">{settings.tempo} {m.bpm()}</span>
				</label>
				<input
					id="tempo"
					type="range"
					min="40"
					max="200"
					step="5"
					bind:value={settings.tempo}
					onchange={onTempoChange}
				/>
			</div>
		</div>
	</div>
</details>

<style>
	.controls {
		margin-bottom: 1.5rem;
		border: none;
	}

	.controls summary {
		cursor: pointer;
		list-style: none;
		padding: 0.5rem 0;
		user-select: none;
		transition: opacity 0.15s;
	}

	.controls summary:hover {
		opacity: 0.8;
	}

	.controls summary::-webkit-details-marker {
		display: none;
	}

	.summary-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.summary-label {
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: #9a8e82;
	}

	.summary-values {
		font-size: 0.72rem;
		color: #c4b8aa;
	}

	.controls summary::before {
		content: '\25B8';
		display: inline-block;
		font-size: 0.6rem;
		color: #c4b8aa;
		margin-right: 0.3rem;
		transition: transform 0.2s;
	}

	.controls[open] summary::before {
		transform: rotate(90deg);
	}

	.controls-body {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		background: #fff;
		border: 1px solid #e8e0d4;
		border-radius: 12px;
		margin-top: 0.35rem;
		box-shadow: 0 1px 3px rgba(58, 122, 76, 0.03);
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.control-group label {
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #9a8e82;
	}

	.control-group label .value {
		text-transform: none;
		letter-spacing: normal;
		font-weight: 600;
		color: #5c5249;
	}

	.key-label {
		text-transform: none;
		letter-spacing: normal;
		font-weight: 600;
		color: #5c5249;
	}

	.key-row {
		display: flex;
		align-items: center;
		gap: 3px;
		flex-wrap: wrap;
	}

	.row-label {
		font-size: 0.8rem;
		width: 1.25rem;
		text-align: center;
		color: #c4b8aa;
	}

	.key-row button {
		width: 1.7rem;
		height: 1.7rem;
		border: 1px solid #e8e0d4;
		border-radius: 6px;
		background: transparent;
		cursor: pointer;
		font-family: 'DM Sans', sans-serif;
		font-size: 0.7rem;
		font-weight: 500;
		color: #8a7d72;
		transition: all 0.15s;
		padding: 0;
	}

	.key-row button:hover {
		background: rgba(58, 122, 76, 0.05);
		border-color: #c4b8aa;
	}

	.key-row button.active {
		background: #3a7a4c;
		color: white;
		border-color: #3a7a4c;
		box-shadow: 0 1px 4px rgba(58, 122, 76, 0.2);
	}

	.key-row button.natural {
		font-size: 0.9rem;
		font-weight: 700;
	}

	.control-row {
		display: flex;
		gap: 1.5rem;
	}

	.control-row .control-group {
		flex: 1;
	}

	input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 4px;
		border-radius: 2px;
		background: #e8e0d4;
		outline: none;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #3a7a4c;
		cursor: pointer;
		border: 2px solid #fff;
		box-shadow: 0 1px 4px rgba(58, 122, 76, 0.25);
		transition: box-shadow 0.15s;
	}

	input[type='range']::-webkit-slider-thumb:hover {
		box-shadow: 0 1px 6px rgba(58, 122, 76, 0.35);
	}

	input[type='range']::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #3a7a4c;
		cursor: pointer;
		border: 2px solid #fff;
		box-shadow: 0 1px 4px rgba(58, 122, 76, 0.25);
	}

	@media (max-width: 600px) {
		.control-row {
			flex-direction: column;
			gap: 0.75rem;
		}

		.key-row {
			justify-content: center;
		}

		.controls-body {
			padding: 0.75rem;
		}
	}
</style>
