<script lang="ts">
	import { onMount } from 'svelte';
	import AppHeader from '$lib/AppHeader.svelte';
	import ExercisePanel from '$lib/ExercisePanel.svelte';
	import SettingsPanel from '$lib/SettingsPanel.svelte';
	import { playNote, playSequence } from '$lib/audio';
	import { generateExercise, type Exercise, type ExerciseSettings, DEFAULT_SETTINGS } from '$lib/music';
	import { pauseListening, resumeListening } from '$lib/microphone';
	import { m } from '$lib/paraglide/messages.js';
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

	function regenerateExercise() {
		saveSettings(settings);
		exercise = generateExercise(settings);
		highlightIndex = -1;
		stopPlayback();
	}

	function setSharps(value: number) {
		settings.sharps = value;
		settings.flats = 0;
		regenerateExercise();
	}

	function setFlats(value: number) {
		settings.flats = value;
		settings.sharps = 0;
		regenerateExercise();
	}

	function resetKeySignature() {
		settings.sharps = 0;
		settings.flats = 0;
		regenerateExercise();
	}

	function setMode(nextMode: 'practice' | 'quiz') {
		mode = nextMode;
		stopPlayback();
		highlightIndex = -1;
	}

	async function play() {
		if (!exercise || isPlaying) return;
		isPlaying = true;

		const seq = playSequence(
			exercise.notes.map((note) => ({ midi: note.midi, duration: note.duration })),
			exercise.tempo,
			(index) => {
				highlightIndex = index;
			}
		);

		abortPlayback = seq.abort;

		try {
			await seq.promise;
		} finally {
			highlightIndex = -1;
			isPlaying = false;
			abortPlayback = null;
		}
	}

	function stopPlayback() {
		abortPlayback?.();
		abortPlayback = null;
		isPlaying = false;
		highlightIndex = -1;
	}

	async function previewQuizNote(noteIndex: number) {
		const currentExercise = exercise;
		if (!currentExercise) return;

		pauseListening();
		try {
			await playNote(currentExercise.notes[noteIndex].midi, 0.4);
			await new Promise((resolve) => setTimeout(resolve, 200));
		} finally {
			resumeListening();
		}
	}

	function applyTempoChange() {
		saveSettings(settings);
		if (exercise) {
			exercise.tempo = settings.tempo;
		}
	}
</script>

<svelte:head>
	<title>{m.app_title()} — {m.app_subtitle()}</title>
	<meta name="description" content={m.meta_description()} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<main>
	<AppHeader />

	{#if exercise}
		<ExercisePanel
			{exercise}
			{mode}
			{highlightIndex}
			{isPlaying}
			onModeChange={setMode}
			onGenerate={regenerateExercise}
			onPlay={play}
			onStopPlayback={stopPlayback}
			onQuizNoteClick={previewQuizNote}
			onQuizNoteChange={(index) => {
				highlightIndex = index;
			}}
		/>
	{/if}

	<SettingsPanel
		{settings}
		onSetSharps={setSharps}
		onSetFlats={setFlats}
		onResetKey={resetKeySignature}
		onSettingsChange={regenerateExercise}
		onTempoChange={applyTempoChange}
	/>

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

	@media (max-width: 600px) {
		main {
			padding: 1rem 0.75rem 1.5rem;
		}
	}
</style>
