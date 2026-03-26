/**
 * Convert Primavera Exercise data to ABC notation strings for abcjs rendering.
 */

import type { Exercise, Note, NoteName } from './music';
import { getKeySignatureNotes } from './music';

/** Map sharps count to ABC key name */
const SHARP_KEYS: Record<number, string> = {
	0: 'C',
	1: 'G',
	2: 'D',
	3: 'A',
	4: 'E',
	5: 'B',
	6: 'F#',
	7: 'C#'
};

/** Map flats count to ABC key name */
const FLAT_KEYS: Record<number, string> = {
	0: 'C',
	1: 'F',
	2: 'Bb',
	3: 'Eb',
	4: 'Ab',
	5: 'Db',
	6: 'Gb',
	7: 'Cb'
};

/**
 * Convert a single Note to ABC notation.
 *
 * ABC note conventions:
 * - C D E F G A B = octave 4 (middle C octave)
 * - c d e f g a b = octave 5
 * - c' d' ... = octave 6
 * - C, D, ... = octave 3
 *
 * Accidentals: ^ = sharp, _ = flat, = = natural
 */
function noteToAbc(note: Note, keySigNotes: Set<NoteName>, isSharps: boolean): string {
	let abc = '';

	// Add accidental prefix if it's not already in the key signature
	const inKeySig = keySigNotes.has(note.name);
	if (note.accidental === 'sharp' && !inKeySig) {
		abc += '^';
	} else if (note.accidental === 'flat' && !inKeySig) {
		abc += '_';
	} else if (note.accidental === 'natural' && inKeySig) {
		// Explicit natural to cancel key signature
		abc += '=';
	}

	// Note letter: uppercase for octave 4 and below, lowercase for octave 5+
	let letter: string = note.name;
	if (note.octave >= 5) {
		letter = letter.toLowerCase();
	}
	abc += letter;

	// Octave modifiers
	if (note.octave >= 6) {
		abc += "'".repeat(note.octave - 5);
	} else if (note.octave <= 3) {
		abc += ','.repeat(4 - note.octave);
	}

	return abc;
}

/** Convert a full Exercise to an ABC notation string */
export function exerciseToAbc(exercise: Exercise): string {
	const key =
		exercise.sharps > 0 ? SHARP_KEYS[exercise.sharps] : FLAT_KEYS[exercise.flats];

	const keySigNotes = getKeySignatureNotes(exercise.sharps, exercise.flats);
	const isSharps = exercise.sharps > 0;

	const abcNotes = exercise.notes.map((n) => noteToAbc(n, keySigNotes, isSharps));

	// Group into bars of 4 (based on time signature)
	const beatsPerBar = exercise.timeSignatureTop;
	const bars: string[] = [];
	for (let i = 0; i < abcNotes.length; i += beatsPerBar) {
		bars.push(abcNotes.slice(i, i + beatsPerBar).join(' '));
	}

	return [
		'X:1',
		`M:${exercise.timeSignatureTop}/${exercise.timeSignatureBottom}`,
		'L:1/4',
		`Q:1/4=${exercise.tempo}`,
		`K:${key}`,
		bars.join(' | ') + ' |]'
	].join('\n');
}
