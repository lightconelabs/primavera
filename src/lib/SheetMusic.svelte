<script lang="ts">
	import type { Exercise, Note, NoteName } from './music';
	import { noteToStaffPosition, getKeySignatureNotes } from './music';
	import { playNote } from './audio';

	// Constants for key signature rendering
	const SHARP_ORDER_NOTES: NoteName[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
	const FLAT_ORDER_NOTES: NoteName[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

	interface Props {
		exercise: Exercise;
		highlightIndex?: number;
	}

	let { exercise, highlightIndex = -1 }: Props = $props();

	// Layout constants
	const STAFF_TOP = 60;
	const LINE_SPACING = 12;
	const STAFF_HEIGHT = LINE_SPACING * 4; // 5 lines, 4 spaces
	const NOTE_START_X = 120;
	const NOTE_SPACING = 50;
	const NOTE_RADIUS = 5.5;
	const MARGIN_RIGHT = 40;

	// Staff lines are for E4, G4, B4, D5, F5 (treble clef)
	// Staff position of bottom line (E4) = 2
	const BOTTOM_LINE_POSITION = 2; // E4

	/** Convert staff position to Y coordinate */
	function staffPosToY(pos: number): number {
		// Bottom line (E4, pos=2) is at STAFF_TOP + STAFF_HEIGHT
		// Each step up moves half a line spacing
		return STAFF_TOP + STAFF_HEIGHT - (pos - BOTTOM_LINE_POSITION) * (LINE_SPACING / 2);
	}

	/** Get the key signature x offset width */
	function keySignatureWidth(): number {
		const count = exercise.sharps || exercise.flats;
		if (count === 0) return 0;
		return count * 12 + 10;
	}

	/** Compute the total SVG width */
	function svgWidth(): number {
		const keySigW = keySignatureWidth();
		return NOTE_START_X + keySigW + exercise.notes.length * NOTE_SPACING + MARGIN_RIGHT;
	}

	/** Get positions for key signature accidentals */
	function keySignaturePositions(): { x: number; y: number; type: 'sharp' | 'flat' }[] {
		const positions: { x: number; y: number; type: 'sharp' | 'flat' }[] = [];
		const baseX = NOTE_START_X - 5;

		if (exercise.sharps > 0) {
			// Sharp octaves on treble clef staff for standard positions
			const sharpOctaves = [5, 4, 5, 4, 4, 4, 4]; // F5 C5 G5 D5 A4 E5 B4 — standard treble
			const sharpStaffOctaves = [5, 5, 5, 5, 4, 5, 4];
			for (let i = 0; i < exercise.sharps; i++) {
				const name = SHARP_ORDER_NOTES[i];
				const oct = sharpStaffOctaves[i];
				const y = staffPosToY(noteToStaffPosition(name, oct));
				positions.push({ x: baseX + i * 12, y, type: 'sharp' });
			}
		} else if (exercise.flats > 0) {
			const flatStaffOctaves = [4, 5, 4, 5, 4, 5, 4];
			for (let i = 0; i < exercise.flats; i++) {
				const name = FLAT_ORDER_NOTES[i];
				const oct = flatStaffOctaves[i];
				const y = staffPosToY(noteToStaffPosition(name, oct));
				positions.push({ x: baseX + i * 12, y, type: 'flat' });
			}
		}

		return positions;
	}

	/** Check if a note needs ledger lines and return their Y positions */
	function ledgerLines(note: Note): number[] {
		const pos = noteToStaffPosition(note.name, note.octave);
		const lines: number[] = [];

		// Below staff: C4 (pos=0), need ledger at pos=0
		if (pos <= 0) {
			for (let p = 0; p >= pos; p -= 2) {
				lines.push(staffPosToY(p));
			}
		}
		// Above staff: A5 (pos=12) and above, need ledger lines
		if (pos >= 12) {
			for (let p = 12; p <= pos; p += 2) {
				lines.push(staffPosToY(p));
			}
		}

		return lines;
	}

	function handleNoteHover(note: Note) {
		playNote(note.midi, 0.4);
	}

	function noteX(index: number): number {
		return NOTE_START_X + keySignatureWidth() + index * NOTE_SPACING;
	}

	/** Check if a note's accidental is already covered by the key signature */
	function isAccidentalInKeySignature(note: Note): boolean {
		if (!note.accidental) return false;
		const keySigNotes = getKeySignatureNotes(exercise.sharps, exercise.flats);
		return keySigNotes.has(note.name);
	}
</script>

<svg
	viewBox="0 0 {svgWidth()} 180"
	width={svgWidth()}
	height="180"
	xmlns="http://www.w3.org/2000/svg"
	role="img"
	aria-label="Sheet music exercise"
>
	<!-- Staff lines -->
	{#each [0, 1, 2, 3, 4] as lineIdx}
		<line
			x1="30"
			y1={STAFF_TOP + lineIdx * LINE_SPACING}
			x2={svgWidth() - 20}
			y2={STAFF_TOP + lineIdx * LINE_SPACING}
			stroke="#333"
			stroke-width="1"
		/>
	{/each}

	<!-- Treble clef (simplified text glyph) -->
	<text
		x="35"
		y={STAFF_TOP + STAFF_HEIGHT - 2}
		font-size="56"
		font-family="serif"
		fill="#333"
	>𝄞</text>

	<!-- Key signature -->
	{#each keySignaturePositions() as ks}
		{#if ks.type === 'sharp'}
			<text x={ks.x} y={ks.y + 5} font-size="16" font-family="serif" fill="#333">♯</text>
		{:else}
			<text x={ks.x} y={ks.y + 5} font-size="16" font-family="serif" fill="#333">♭</text>
		{/if}
	{/each}

	<!-- Barlines every 4 notes -->
	{#each exercise.notes as _, i}
		{#if i > 0 && i % 4 === 0}
			<line
				x1={noteX(i) - NOTE_SPACING / 2 + 5}
				y1={STAFF_TOP}
				x2={noteX(i) - NOTE_SPACING / 2 + 5}
				y2={STAFF_TOP + STAFF_HEIGHT}
				stroke="#333"
				stroke-width="1"
			/>
		{/if}
	{/each}

	<!-- Final barline -->
	<line
		x1={svgWidth() - 25}
		y1={STAFF_TOP}
		x2={svgWidth() - 25}
		y2={STAFF_TOP + STAFF_HEIGHT}
		stroke="#333"
		stroke-width="1.5"
	/>
	<line
		x1={svgWidth() - 22}
		y1={STAFF_TOP}
		x2={svgWidth() - 22}
		y2={STAFF_TOP + STAFF_HEIGHT}
		stroke="#333"
		stroke-width="3"
	/>

	<!-- Notes -->
	{#each exercise.notes as note, i}
		{@const pos = noteToStaffPosition(note.name, note.octave)}
		{@const cx = noteX(i)}
		{@const cy = staffPosToY(pos)}
		{@const isHighlighted = i === highlightIndex}

		<!-- Ledger lines -->
		{#each ledgerLines(note) as ly}
			<line
				x1={cx - 10}
				y1={ly}
				x2={cx + 10}
				y2={ly}
				stroke="#333"
				stroke-width="1"
			/>
		{/each}

		<!-- Note head (interactive) -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<g
			class="note-group"
			onmouseenter={() => handleNoteHover(note)}
			style="cursor: pointer;"
		>
			<!-- Larger invisible hit area -->
			<circle cx={cx} cy={cy} r="12" fill="transparent" />

			<!-- Note head -->
			<ellipse
				cx={cx}
				cy={cy}
				rx={NOTE_RADIUS}
				ry={NOTE_RADIUS * 0.8}
				fill={isHighlighted ? '#e74c3c' : '#1a1a1a'}
				transform="rotate(-10, {cx}, {cy})"
			/>

			<!-- Stem -->
			{#if pos < 7}
				<!-- Stem up -->
				<line
					x1={cx + NOTE_RADIUS - 0.5}
					y1={cy}
					x2={cx + NOTE_RADIUS - 0.5}
					y2={cy - 35}
					stroke={isHighlighted ? '#e74c3c' : '#1a1a1a'}
					stroke-width="1.3"
				/>
			{:else}
				<!-- Stem down -->
				<line
					x1={cx - NOTE_RADIUS + 0.5}
					y1={cy}
					x2={cx - NOTE_RADIUS + 0.5}
					y2={cy + 35}
					stroke={isHighlighted ? '#e74c3c' : '#1a1a1a'}
					stroke-width="1.3"
				/>
			{/if}

			<!-- Accidental (only show if NOT already in key signature) -->
			{#if note.accidental && !isAccidentalInKeySignature(note)}
				<text
					x={cx - 15}
					y={cy + 5}
					font-size="14"
					font-family="serif"
					fill={isHighlighted ? '#e74c3c' : '#333'}
				>{note.accidental === 'sharp' ? '♯' : '♭'}</text>
			{/if}
		</g>
	{/each}
</svg>

<style>
	svg {
		display: block;
		max-width: 100%;
		height: auto;
	}

	.note-group:hover ellipse {
		fill: #3498db;
	}

	.note-group:hover line {
		stroke: #3498db;
	}
</style>
