<script lang="ts">
	import { onMount } from 'svelte';
	import SheetMusic from '$lib/SheetMusic.svelte';
	import { generateExercise, type Exercise, type ExerciseSettings, DEFAULT_SETTINGS } from '$lib/music';
	import { playSequence } from '$lib/audio';
	import { loadSettings, saveSettings } from '$lib/store';

	let settings: ExerciseSettings = $state({ ...DEFAULT_SETTINGS });
	let exercise: Exercise | null = $state(null);
	let highlightIndex = $state(-1);
	let isPlaying = $state(false);
	let abortPlayback: (() => void) | null = $state(null);

	onMount(() => {
		settings = loadSettings();
		exercise = generateExercise(settings);
	});

	function generate() {
		// Ensure sharps/flats are mutually exclusive
		saveSettings(settings);
		exercise = generateExercise(settings);
		highlightIndex = -1;
		stopPlayback();
	}

	function setSharps(value: number) {
		settings.sharps = value;
		settings.flats = 0;
		generate();
	}

	function setFlats(value: number) {
		settings.flats = value;
		settings.sharps = 0;
		generate();
	}

	async function play() {
		if (!exercise || isPlaying) return;
		isPlaying = true;

		const seq = playSequence(
			exercise.notes.map((n) => ({ midi: n.midi, duration: n.duration })),
			exercise.tempo
		);
		abortPlayback = seq.abort;

		// Animate highlight
		const beatDuration = 60 / exercise.tempo;
		for (let i = 0; i < exercise.notes.length; i++) {
			if (!isPlaying) break;
			highlightIndex = i;
			await new Promise((r) => setTimeout(r, exercise!.notes[i].duration * beatDuration * 1000));
		}

		await seq.promise;
		highlightIndex = -1;
		isPlaying = false;
		abortPlayback = null;
	}

	function stopPlayback() {
		if (abortPlayback) {
			abortPlayback();
			abortPlayback = null;
		}
		isPlaying = false;
		highlightIndex = -1;
	}

	/** Key signature display name */
	function keySignatureLabel(sharps: number, flats: number): string {
		const keyNames: Record<string, string> = {
			's0': 'C major',
			's1': 'G major', 's2': 'D major', 's3': 'A major',
			's4': 'E major', 's5': 'B major', 's6': 'F♯ major', 's7': 'C♯ major',
			'f1': 'F major', 'f2': 'B♭ major', 'f3': 'E♭ major',
			'f4': 'A♭ major', 'f5': 'D♭ major', 'f6': 'G♭ major', 'f7': 'C♭ major'
		};
		if (flats > 0) return keyNames[`f${flats}`] ?? `${flats} flats`;
		return keyNames[`s${sharps}`] ?? `${sharps} sharps`;
	}

	const intervalLabels: Record<number, string> = {
		1: 'minor 2nd',
		2: 'major 2nd',
		3: 'minor 3rd',
		4: 'major 3rd',
		5: 'perfect 4th',
		6: 'tritone',
		7: 'perfect 5th',
		8: 'minor 6th',
		9: 'major 6th',
		10: 'minor 7th',
		11: 'major 7th',
		12: 'octave'
	};
</script>

<svelte:head>
	<title>Primavera — Sight Reading Practice</title>
	<meta name="description" content="Practice sight reading and sight singing with randomly generated exercises." />
</svelte:head>

<main>
	<header>
		<h1>🌸 Primavera</h1>
		<p class="subtitle">Sight reading & sight singing practice</p>
	</header>

	<section class="sheet-music">
		{#if exercise}
			<div class="sheet-scroll">
				<SheetMusic {exercise} {highlightIndex} />
			</div>
			<div class="actions">
				<button class="btn primary" onclick={generate}>
					New Exercise
				</button>
				{#if isPlaying}
					<button class="btn danger" onclick={stopPlayback}>
						Stop
					</button>
				{:else}
					<button class="btn secondary" onclick={play}>
						▶ Play
					</button>
				{/if}
			</div>
		{/if}
	</section>

	<details class="controls">
		<summary>
			<span class="summary-content">
				<span class="summary-label">Settings</span>
				<span class="summary-values">{keySignatureLabel(settings.sharps, settings.flats)} · {settings.noteCount} notes · {settings.tempo} BPM</span>
			</span>
		</summary>

		<div class="controls-body">
			<div class="control-group">
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label>
					Key
					<span class="key-label">{keySignatureLabel(settings.sharps, settings.flats)}</span>
				</label>
				<div class="key-row">
					<span class="row-label">♭</span>
					{#each [7, 6, 5, 4, 3, 2, 1] as n}
						<button
							class:active={settings.flats === n}
							onclick={() => setFlats(n)}
						>{n}</button>
					{/each}
					<button
						class="natural"
						class:active={settings.sharps === 0 && settings.flats === 0}
						onclick={() => { settings.sharps = 0; settings.flats = 0; generate(); }}
					>♮</button>
					{#each [1, 2, 3, 4, 5, 6, 7] as n}
						<button
							class:active={settings.sharps === n}
							onclick={() => setSharps(n)}
						>{n}</button>
					{/each}
					<span class="row-label">♯</span>
				</div>
			</div>

			<div class="control-group">
				<label for="maxInterval">
					Interval <span class="value">{intervalLabels[settings.maxInterval] ?? `${settings.maxInterval} semitones`}</span>
				</label>
				<input
					id="maxInterval"
					type="range"
					min="1"
					max="12"
					bind:value={settings.maxInterval}
					onchange={generate}
				/>
			</div>

			<div class="control-row">
				<div class="control-group">
					<label for="noteCount">Notes <span class="value">{settings.noteCount}</span></label>
					<input
						id="noteCount"
						type="range"
						min="4"
						max="32"
						step="4"
						bind:value={settings.noteCount}
						onchange={generate}
					/>
				</div>

				<div class="control-group">
					<label for="tempo">Tempo <span class="value">{settings.tempo} BPM</span></label>
					<input
						id="tempo"
						type="range"
						min="40"
						max="200"
						step="5"
						bind:value={settings.tempo}
						onchange={() => { saveSettings(settings); if (exercise) exercise.tempo = settings.tempo; }}
					/>
				</div>
			</div>
		</div>
	</details>

	<footer>
		<p>Click notes to hear them. Press <strong>Play</strong> for the full exercise.</p>
	</footer>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #faf9f7;
		color: #2c2c2c;
	}

	main {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}

	header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	h1 {
		font-size: 1.75rem;
		margin: 0;
		color: #4a2c6a;
	}

	.subtitle {
		margin: 0.15rem 0 0;
		color: #999;
		font-size: 0.85rem;
		font-weight: 300;
	}

	/* ---- Sheet music (primary focus) ---- */

	.sheet-music {
		background: white;
		border: 1px solid #e8e5e0;
		border-radius: 12px;
		padding: 1.5rem 1.5rem 1rem;
		margin-bottom: 1rem;
		overflow-x: auto;
	}

	.sheet-scroll {
		display: flex;
		justify-content: center;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
		padding-top: 0.75rem;
		border-top: 1px solid #f0eeeb;
	}

	.btn {
		padding: 0.45rem 1.25rem;
		border: none;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		letter-spacing: 0.01em;
	}

	.btn.primary {
		background: #4a2c6a;
		color: white;
	}

	.btn.primary:hover {
		background: #5d3a82;
	}

	.btn.secondary {
		background: #f0eeeb;
		color: #4a2c6a;
	}

	.btn.secondary:hover {
		background: #e5e2de;
	}

	.btn.danger {
		background: #f0eeeb;
		color: #c0392b;
	}

	.btn.danger:hover {
		background: #e5e2de;
	}

	/* ---- Settings (collapsible, secondary) ---- */

	.controls {
		margin-bottom: 1.5rem;
		border: none;
	}

	.controls summary {
		cursor: pointer;
		list-style: none;
		padding: 0.5rem 0;
		user-select: none;
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
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #999;
	}

	.summary-values {
		font-size: 0.75rem;
		color: #bbb;
	}

	.controls summary::before {
		content: '▸';
		display: inline-block;
		font-size: 0.65rem;
		color: #bbb;
		margin-right: 0.35rem;
		transition: transform 0.15s;
	}

	.controls[open] summary::before {
		transform: rotate(90deg);
	}

	.controls-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: white;
		border: 1px solid #eee;
		border-radius: 8px;
		margin-top: 0.25rem;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.control-group label {
		font-size: 0.7rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #999;
	}

	.control-group label .value {
		text-transform: none;
		letter-spacing: normal;
		font-weight: 600;
		color: #666;
	}

	.key-label {
		text-transform: none;
		letter-spacing: normal;
		font-weight: 600;
		color: #666;
	}

	.key-row {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-wrap: wrap;
	}

	.row-label {
		font-size: 0.75rem;
		width: 1.25rem;
		text-align: center;
		color: #bbb;
	}

	.key-row button {
		width: 1.6rem;
		height: 1.6rem;
		border: 1px solid #e8e5e0;
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		font-size: 0.7rem;
		color: #888;
		transition: all 0.15s;
		padding: 0;
	}

	.key-row button:hover {
		background: #f5f3f0;
		border-color: #ccc;
	}

	.key-row button.active {
		background: #4a2c6a;
		color: white;
		border-color: #4a2c6a;
	}

	.key-row button.natural {
		font-size: 0.85rem;
		font-weight: bold;
	}

	.control-row {
		display: flex;
		gap: 1.5rem;
	}

	.control-row .control-group {
		flex: 1;
	}

	input[type='range'] {
		width: 100%;
		accent-color: #4a2c6a;
		height: 4px;
	}

	footer {
		text-align: center;
		font-size: 0.75rem;
		color: #bbb;
	}

	@media (max-width: 600px) {
		.control-row {
			flex-direction: column;
			gap: 0.75rem;
		}

		.key-row {
			justify-content: center;
		}
	}
</style>
