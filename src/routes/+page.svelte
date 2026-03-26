<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref, getLocale, locales } from '$lib/paraglide/runtime.js';
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

	function keySignatureLabel(sharps: number, flats: number): string {
		const keyNames: Record<string, () => string> = {
			's0': m.key_c_major,
			's1': m.key_g_major, 's2': m.key_d_major, 's3': m.key_a_major,
			's4': m.key_e_major, 's5': m.key_b_major, 's6': m.key_f_sharp_major, 's7': m.key_c_sharp_major,
			'f1': m.key_f_major, 'f2': m.key_b_flat_major, 'f3': m.key_e_flat_major,
			'f4': m.key_a_flat_major, 'f5': m.key_d_flat_major, 'f6': m.key_g_flat_major, 'f7': m.key_c_flat_major
		};
		if (flats > 0) return keyNames[`f${flats}`]?.() ?? m.n_flats({ count: flats });
		return keyNames[`s${sharps}`]?.() ?? m.n_sharps({ count: sharps });
	}

	const intervalLabels: Record<number, () => string> = {
		1: m.interval_minor_2nd,
		2: m.interval_major_2nd,
		3: m.interval_minor_3rd,
		4: m.interval_major_3rd,
		5: m.interval_perfect_4th,
		6: m.interval_tritone,
		7: m.interval_perfect_5th,
		8: m.interval_minor_6th,
		9: m.interval_major_6th,
		10: m.interval_minor_7th,
		11: m.interval_major_7th,
		12: m.interval_octave
	};
</script>

<svelte:head>
	<title>{m.app_title()} — {m.app_subtitle()}</title>
	<meta name="description" content={m.meta_description()} />
</svelte:head>

<main>
	<header>
		<h1>🌸 {m.app_title()}</h1>
		<p class="subtitle">{m.app_subtitle()}</p>
		<nav class="lang-switcher" aria-label="Language">
			{#each locales as locale}
				<a
					href={localizeHref($page.url.pathname, { locale })}
					class:active={getLocale() === locale}
					data-sveltekit-reload
					aria-current={getLocale() === locale ? 'page' : undefined}
				>{locale.toUpperCase()}</a>
			{/each}
		</nav>
	</header>

	<section class="sheet-music">
		{#if exercise}
			<div class="sheet-scroll">
				<SheetMusic {exercise} {highlightIndex} />
			</div>
			<div class="actions">
				<button class="btn primary" onclick={generate}>
					{m.new_exercise()}
				</button>
				{#if isPlaying}
					<button class="btn danger" onclick={stopPlayback}>
						{m.stop()}
					</button>
				{:else}
					<button class="btn secondary" onclick={play}>
						▶ {m.play()}
					</button>
				{/if}
			</div>
		{/if}
	</section>

	<details class="controls">
		<summary>
			<span class="summary-content">
				<span class="summary-label">{m.settings()}</span>
				<span class="summary-values">{keySignatureLabel(settings.sharps, settings.flats)} · {settings.noteCount} {m.notes()} · {settings.tempo} {m.bpm()}</span>
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
					{m.interval()} <span class="value">{intervalLabels[settings.maxInterval]?.() ?? `${settings.maxInterval} semitones`}</span>
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
					<label for="noteCount">{m.notes()} <span class="value">{settings.noteCount}</span></label>
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
					<label for="tempo">{m.tempo()} <span class="value">{settings.tempo} {m.bpm()}</span></label>
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
		<p>{@html m.footer_hint()}</p>
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

	.lang-switcher {
		display: flex;
		gap: 0.25rem;
		justify-content: center;
		margin-top: 0.5rem;
	}

	.lang-switcher a {
		font-size: 0.7rem;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		text-decoration: none;
		color: #999;
		font-weight: 500;
		letter-spacing: 0.04em;
		transition: all 0.15s;
	}

	.lang-switcher a:hover {
		color: #4a2c6a;
		background: #f5f3f0;
	}

	.lang-switcher a.active {
		color: #4a2c6a;
		background: #f0eeeb;
		font-weight: 600;
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
