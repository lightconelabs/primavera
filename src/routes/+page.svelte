<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref, getLocale, locales } from '$lib/paraglide/runtime.js';
	import SheetMusic from '$lib/SheetMusic.svelte';
	import QuizMode from '$lib/QuizMode.svelte';
	import { generateExercise, type Exercise, type ExerciseSettings, DEFAULT_SETTINGS } from '$lib/music';
	import { playSequence, playNote } from '$lib/audio';
	import { pauseListening, resumeListening } from '$lib/microphone';
	import { loadSettings, saveSettings } from '$lib/store';

	let settings: ExerciseSettings = $state({ ...DEFAULT_SETTINGS });
	let mode: 'practice' | 'quiz' = $state('practice');
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
			exercise.tempo,
			(index) => { highlightIndex = index; }
		);
		abortPlayback = seq.abort;

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
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&display=swap" rel="stylesheet" />
</svelte:head>

<main>
	<header>
		<div class="header-row">
			<div class="brand">
				<img src="/primavera-logo.png" alt="Primavera" class="logo" />
				<p class="subtitle">{m.app_subtitle()}</p>
			</div>
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
		</div>
	</header>

	<section class="sheet-music">
		{#if exercise}
			<div class="mode-toggle" role="tablist">
				<button
					class="toggle-btn"
					class:active={mode === 'practice'}
					role="tab"
					aria-selected={mode === 'practice'}
					onclick={() => { mode = 'practice'; stopPlayback(); highlightIndex = -1; }}
				>
					<span class="toggle-icon">&#9835;</span>
					{m.practice_mode()}
				</button>
				<button
					class="toggle-btn"
					class:active={mode === 'quiz'}
					role="tab"
					aria-selected={mode === 'quiz'}
					onclick={() => { mode = 'quiz'; stopPlayback(); highlightIndex = -1; }}
				>
					<span class="toggle-icon">&#9834;</span>
					{m.quiz_mode()}
				</button>
				<div class="toggle-slider" class:right={mode === 'quiz'}></div>
			</div>

			<div class="sheet-scroll">
				<SheetMusic {exercise} {highlightIndex} onNoteClick={mode === 'quiz' ? async (noteIndex) => {
					pauseListening();
					await playNote(exercise.notes[noteIndex].midi, 0.4);
					await new Promise(r => setTimeout(r, 200));
					resumeListening();
				} : undefined} />
			</div>

			<div class="action-bar">
				<button class="btn primary" onclick={generate}>
					{m.new_exercise()}
				</button>
				{#if mode === 'practice'}
					{#if isPlaying}
						<button class="btn danger" onclick={stopPlayback}>
							{m.stop()}
						</button>
					{:else}
						<button class="btn secondary" onclick={play}>
							&#9654; {m.play()}
						</button>
					{/if}
				{/if}
			</div>

			{#if mode === 'quiz'}
				<QuizMode
					{exercise}
					onComplete={(finalScore) => {}}
					onNoteChange={(index) => { highlightIndex = index; }}
				/>
			{/if}
		{/if}
	</section>

	<details class="controls">
		<summary>
			<span class="summary-content">
				<span class="summary-label">{m.settings()}</span>
				<span class="summary-values">{keySignatureLabel(settings.sharps, settings.flats)} &middot; {settings.noteCount} {m.notes()} &middot; {settings.tempo} {m.bpm()}</span>
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
						<button
							class:active={settings.flats === n}
							onclick={() => setFlats(n)}
						>{n}</button>
					{/each}
					<button
						class="natural"
						class:active={settings.sharps === 0 && settings.flats === 0}
						onclick={() => { settings.sharps = 0; settings.flats = 0; generate(); }}
					>&#9838;</button>
					{#each [1, 2, 3, 4, 5, 6, 7] as n}
						<button
							class:active={settings.sharps === n}
							onclick={() => setSharps(n)}
						>{n}</button>
					{/each}
					<span class="row-label">&#9839;</span>
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
		font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
		background: #faf5ee;
		color: #2d2a26;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	main {
		max-width: 880px;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 2rem;
	}

	/* ---- Header ---- */

	header {
		margin-bottom: 1.25rem;
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.logo {
		height: 40px;
		image-rendering: pixelated;
		flex-shrink: 0;
	}

	.subtitle {
		margin: 0;
		color: #9a8e82;
		font-size: 0.78rem;
		font-weight: 400;
		letter-spacing: 0.01em;
	}

	.lang-switcher {
		display: flex;
		gap: 0.2rem;
		flex-shrink: 0;
	}

	.lang-switcher a {
		font-size: 0.65rem;
		padding: 0.2rem 0.45rem;
		border-radius: 5px;
		text-decoration: none;
		color: #b0a496;
		font-weight: 600;
		letter-spacing: 0.06em;
		transition: color 0.2s, background 0.2s;
	}

	.lang-switcher a:hover {
		color: #3a7a4c;
		background: rgba(58, 122, 76, 0.06);
	}

	.lang-switcher a.active {
		color: #3a7a4c;
		background: rgba(58, 122, 76, 0.08);
	}

	/* ---- Sheet music card ---- */

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

	/* ---- Mode toggle (first-class nav) ---- */

	.mode-toggle {
		display: flex;
		position: relative;
		margin: 0.75rem auto 0;
		background: rgba(58, 122, 76, 0.05);
		border-radius: 10px;
		padding: 3px;
		width: fit-content;
		gap: 0;
	}

	.toggle-btn {
		position: relative;
		z-index: 1;
		padding: 0.45rem 1.2rem;
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
		top: 3px;
		left: 3px;
		width: calc(50% - 3px);
		height: calc(100% - 6px);
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 1px 4px rgba(58, 122, 76, 0.1);
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		pointer-events: none;
	}

	.toggle-slider.right {
		transform: translateX(100%);
	}

	/* ---- Action bar ---- */

	.action-bar {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
		padding: 0.75rem 1.25rem 1rem;
		border-top: 1px solid #f0ebe3;
	}

	.btn {
		padding: 0.5rem 1.3rem;
		border: none;
		border-radius: 8px;
		font-family: 'DM Sans', sans-serif;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		letter-spacing: 0.01em;
	}

	.btn:active {
		transform: scale(0.97);
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

	footer {
		text-align: center;
		font-size: 0.72rem;
		color: #c4b8aa;
		padding-top: 0.5rem;
	}

	footer :global(a) {
		color: #9a8e82;
		text-decoration-color: #ddd5c9;
	}

	/* ---- Responsive ---- */

	@media (max-width: 600px) {
		main {
			padding: 1rem 0.75rem 1.5rem;
		}

		.header-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.lang-switcher {
			align-self: flex-start;
		}

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
			padding: 0.65rem 0.75rem 0.85rem;
			flex-wrap: wrap;
		}

		.btn {
			flex: 1;
			min-width: 0;
			text-align: center;
		}

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

	@media (max-width: 380px) {
		.toggle-icon {
			display: none;
		}
	}
</style>
