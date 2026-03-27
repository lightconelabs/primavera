/**
 * Core music data model for Primavera sight-reading exercises.
 */

/** Chromatic note names */
export const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type NoteName = (typeof NOTE_NAMES)[number];

/** Accidental applied to a note */
export type Accidental = 'sharp' | 'flat' | 'natural' | null;

/** A single note in the exercise */
export interface Note {
	/** Note letter name (C-B) */
	name: NoteName;
	/** Octave number (e.g. 4 = middle C octave) */
	octave: number;
	/** Accidental modifier */
	accidental: Accidental;
	/** MIDI note number (for audio playback) */
	midi: number;
	/** Duration in beats (default 1 = quarter note) */
	duration: number;
}

/** A sight-reading exercise */
export interface Exercise {
	/** The notes in the exercise */
	notes: Note[];
	/** Number of sharps in key signature (0-7) */
	sharps: number;
	/** Number of flats in key signature (0-7) */
	flats: number;
	/** Maximum interval between consecutive notes (in semitones) */
	maxInterval: number;
	/** Time signature numerator */
	timeSignatureTop: number;
	/** Time signature denominator */
	timeSignatureBottom: number;
	/** Tempo in BPM */
	tempo: number;
}

/** Settings for exercise generation */
export interface ExerciseSettings {
	/** Number of sharps (0-7, mutually exclusive with flats) */
	sharps: number;
	/** Number of flats (0-7, mutually exclusive with sharps) */
	flats: number;
	/** Maximum interval in semitones between consecutive notes */
	maxInterval: number;
	/** Number of notes to generate */
	noteCount: number;
	/** Tempo in BPM */
	tempo: number;
}

export const DEFAULT_SETTINGS: ExerciseSettings = {
	sharps: 0,
	flats: 0,
	maxInterval: 3,
	noteCount: 16,
	tempo: 80
};

/**
 * Map from note name to its position in the chromatic scale (semitones from C).
 */
const SEMITONE_MAP: Record<NoteName, number> = {
	C: 0,
	D: 2,
	E: 4,
	F: 5,
	G: 7,
	A: 9,
	B: 11
};

/**
 * Sharp key signatures: number of sharps -> which notes are sharp.
 * Order of sharps: F C G D A E B
 */
const SHARP_ORDER: NoteName[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];

/**
 * Flat key signatures: number of flats -> which notes are flat.
 * Order of flats: B E A D G C F
 */
const FLAT_ORDER: NoteName[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** Get the set of altered notes for the given key signature */
export function getKeySignatureNotes(sharps: number, flats: number): Set<NoteName> {
	const altered = new Set<NoteName>();
	if (sharps > 0) {
		for (let i = 0; i < sharps; i++) altered.add(SHARP_ORDER[i]);
	} else if (flats > 0) {
		for (let i = 0; i < flats; i++) altered.add(FLAT_ORDER[i]);
	}
	return altered;
}

/** Convert a note name + octave + accidental to MIDI number */
export function noteToMidi(name: NoteName, octave: number, accidental: Accidental): number {
	let midi = (octave + 1) * 12 + SEMITONE_MAP[name];
	if (accidental === 'sharp') midi += 1;
	if (accidental === 'flat') midi -= 1;
	return midi;
}

/** Convert MIDI number to frequency in Hz */
export function midiToFrequency(midi: number): number {
	return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Convert frequency in Hz to nearest MIDI note number */
export function frequencyToMidi(hz: number): number {
	return Math.round(69 + 12 * Math.log2(hz / 440));
}

/**
 * Staff position: number of diatonic steps from middle C (C4).
 * C4 = 0, D4 = 1, E4 = 2, ... C5 = 7, etc.
 * Used for vertical placement on the staff.
 */
export function noteToStaffPosition(name: NoteName, octave: number): number {
	const nameIndex = NOTE_NAMES.indexOf(name);
	return (octave - 4) * 7 + nameIndex;
}

/** Get the interval in semitones between two MIDI notes */
function midiInterval(a: number, b: number): number {
	return Math.abs(a - b);
}

/** All diatonic scale degrees as (name, octave) pairs in a range */
function getDiatonicRange(
	lowOctave: number,
	highOctave: number,
	alteredNotes: Set<NoteName>,
	isSharps: boolean
): { name: NoteName; octave: number; accidental: Accidental; midi: number }[] {
	const result: { name: NoteName; octave: number; accidental: Accidental; midi: number }[] = [];
	for (let oct = lowOctave; oct <= highOctave; oct++) {
		for (const name of NOTE_NAMES) {
			const accidental: Accidental = alteredNotes.has(name)
				? isSharps
					? 'sharp'
					: 'flat'
				: null;
			const midi = noteToMidi(name, oct, accidental);
			result.push({ name, octave: oct, accidental, midi });
		}
	}
	return result;
}

/** Generate a random sight-reading exercise */
export function generateExercise(settings: ExerciseSettings): Exercise {
	const { sharps, flats, maxInterval, noteCount, tempo } = settings;
	const alteredNotes = getKeySignatureNotes(sharps, flats);
	const isSharps = sharps > 0;

	// Available notes: treble clef range roughly C4 to C6
	const pool = getDiatonicRange(4, 5, alteredNotes, isSharps);

	const notes: Note[] = [];

	// Start on a random note within the first octave
	const firstOctaveNotes = pool.filter((n) => n.octave === 4);
	const startNote = firstOctaveNotes[Math.floor(Math.random() * firstOctaveNotes.length)] ?? pool[0];
	notes.push({
		name: startNote.name,
		octave: startNote.octave,
		accidental: startNote.accidental,
		midi: startNote.midi,
		duration: 1
	});

	for (let i = 1; i < noteCount; i++) {
		const prev = notes[i - 1];
		// Filter pool to notes within maxInterval semitones of the previous note
		const candidates = pool.filter(
			(n) => midiInterval(n.midi, prev.midi) <= maxInterval && n.midi !== prev.midi
		);

		if (candidates.length === 0) {
			// Fallback: pick any note from pool
			const pick = pool[Math.floor(Math.random() * pool.length)];
			notes.push({ ...pick, duration: 1 });
		} else {
			const pick = candidates[Math.floor(Math.random() * candidates.length)];
			notes.push({ ...pick, duration: 1 });
		}
	}

	return {
		notes,
		sharps,
		flats,
		maxInterval,
		timeSignatureTop: 4,
		timeSignatureBottom: 4,
		tempo
	};
}
