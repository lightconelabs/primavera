<script lang="ts">
	import { onMount } from 'svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import ExercisePanel from '$lib/components/ExercisePanel.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import { createExercisePageController } from '$lib/components/exercisePageState.svelte';
	import { m } from '$lib/paraglide/messages.js';

	const controller = createExercisePageController();

	onMount(() => {
		controller.init();
	});
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

	{#if controller.exercise}
		<ExercisePanel
			exercise={controller.exercise}
			mode={controller.mode}
			highlightIndex={controller.highlightIndex}
			isPlaying={controller.isPlaying}
			onModeChange={controller.setMode}
			onGenerate={controller.regenerateExercise}
			onPlay={controller.play}
			onStopPlayback={controller.stopPlayback}
			onQuizNoteClick={controller.previewQuizNote}
			onQuizNoteChange={controller.setHighlightIndex}
		/>
	{/if}

	<SettingsPanel
		settings={controller.settings}
		onSetSharps={controller.setSharps}
		onSetFlats={controller.setFlats}
		onResetKey={controller.resetKeySignature}
		onSettingsChange={controller.regenerateExercise}
		onTempoChange={controller.applyTempoChange}
	/>

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

@media (max-width: 600px) {
		main {
			padding: 1rem 0.75rem 1.5rem;
		}
	}
</style>
