<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import type { Exercise } from './music';
	import { exerciseToAbc } from './abc';
	import { playNote } from './audio';

	interface Props {
		exercise: Exercise;
		highlightIndex?: number;
		onNoteClick?: (noteIndex: number) => void;
	}

	let { exercise, highlightIndex = -1, onNoteClick }: Props = $props();

	let containerEl: HTMLDivElement;
	let abcjsModulePromise: Promise<typeof import('abcjs')> | null = null;
	let renderToken = 0;

	function getAbcjs() {
		if (!abcjsModulePromise) {
			abcjsModulePromise = import('abcjs');
		}
		return abcjsModulePromise;
	}

	async function render() {
		if (!containerEl) return;
		const token = ++renderToken;
		const abcjs = await getAbcjs();
		if (!containerEl || token !== renderToken) return;

		const { abc, noteCharPositions } = exerciseToAbc(exercise);
		const staffwidth = Math.max(500, exercise.notes.length * 40);
		// Set max-width so the container centers at the natural staff width
		// while responsive:'resize' still allows it to shrink on mobile
		containerEl.style.maxWidth = `${staffwidth + 60}px`;
		abcjs.renderAbc(containerEl, abc, {
			add_classes: true,
			responsive: 'resize',
			staffwidth,
			paddingtop: 0,
			paddingbottom: 0,
			clickListener: (abcElem) => {
				// Try exact match first, then search nearby positions (±3 chars)
				let noteIndex = noteCharPositions.get(abcElem.startChar);
				if (noteIndex === undefined) {
					for (let offset = 1; offset <= 3; offset++) {
						noteIndex = noteCharPositions.get(abcElem.startChar - offset)
							?? noteCharPositions.get(abcElem.startChar + offset);
						if (noteIndex !== undefined) break;
					}
				}
				if (noteIndex !== undefined && exercise.notes[noteIndex]) {
					if (onNoteClick) {
						onNoteClick(noteIndex);
					} else {
						playNote(exercise.notes[noteIndex].midi, 0.4);
					}
				}
			}
		});
	}

	/** Highlight a specific note by index using CSS classes added by abcjs */
	function updateHighlight(index: number) {
		if (!containerEl) return;

		// Remove previous highlights
		containerEl.querySelectorAll('.abcjs-note.abcjs-highlight').forEach((el) => {
			(el as HTMLElement).classList.remove('abcjs-highlight');
		});

		if (index < 0) return;

		// abcjs adds class "abcjs-n{index}" to notes when add_classes is true
		const noteEls = containerEl.querySelectorAll('.abcjs-note');
		if (noteEls[index]) {
			(noteEls[index] as HTMLElement).classList.add('abcjs-highlight');
		}
	}

	onMount(() => {
		render();
	});

	$effect(() => {
		// Re-render when exercise changes
		exercise;
		render();
	});

	$effect(() => {
		updateHighlight(highlightIndex);
	});
</script>

<div bind:this={containerEl} class="sheet-music-container" role="img" aria-label={m.sheet_music_aria()}></div>

<style>
	.sheet-music-container {
		width: 100%;
		margin: 0 auto;
	}

	/* Staff lines: warm dark tone instead of pure black */
	.sheet-music-container :global(svg) {
		overflow: visible;
	}

	.sheet-music-container :global(.abcjs-staff path),
	.sheet-music-container :global(.abcjs-staff-extra path) {
		stroke: #3a3530;
	}

	/* Note hover: spring green accent */
	.sheet-music-container :global(.abcjs-note:hover path),
	.sheet-music-container :global(.abcjs-note:hover circle) {
		fill: #3a7a4c !important;
		cursor: pointer;
	}

	/* Active/highlighted note: cherry blossom pink with glow */
	.sheet-music-container :global(.abcjs-note.abcjs-highlight path),
	.sheet-music-container :global(.abcjs-note.abcjs-highlight circle) {
		fill: #d4849a !important;
		filter: drop-shadow(0 0 4px rgba(212, 132, 154, 0.35));
		transition: fill 0.15s ease;
	}
</style>
