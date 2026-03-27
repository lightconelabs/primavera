import { playNote, playSequence } from '$lib/audio';
import { pauseListening, resumeListening } from '$lib/microphone';
import { generateExercise, type Exercise, type ExerciseSettings, DEFAULT_SETTINGS } from '$lib/music';
import { loadSettings, saveSettings } from '$lib/store';

type Mode = 'practice' | 'quiz';

class ExercisePageController {
	settings = $state<ExerciseSettings>({ ...DEFAULT_SETTINGS });
	mode = $state<Mode>('practice');
	exercise = $state<Exercise | null>(null);
	highlightIndex = $state(-1);
	isPlaying = $state(false);
	private abortPlayback = $state<(() => void) | null>(null);

	init = () => {
		this.settings = loadSettings();
		this.exercise = generateExercise(this.settings);
	};

	regenerateExercise = () => {
		saveSettings(this.settings);
		this.exercise = generateExercise(this.settings);
		this.stopPlayback();
	};

	setSharps = (value: number) => {
		this.settings.sharps = value;
		this.settings.flats = 0;
		this.regenerateExercise();
	};

	setFlats = (value: number) => {
		this.settings.flats = value;
		this.settings.sharps = 0;
		this.regenerateExercise();
	};

	resetKeySignature = () => {
		this.settings.sharps = 0;
		this.settings.flats = 0;
		this.regenerateExercise();
	};

	setMode = (nextMode: Mode) => {
		this.mode = nextMode;
		this.stopPlayback();
	};

	setHighlightIndex = (index: number) => {
		this.highlightIndex = index;
	};

	play = async () => {
		if (!this.exercise || this.isPlaying) return;
		this.isPlaying = true;

		const sequence = playSequence(
			this.exercise.notes.map((note) => ({ midi: note.midi, duration: note.duration })),
			this.exercise.tempo,
			this.setHighlightIndex
		);

		this.abortPlayback = sequence.abort;

		try {
			await sequence.promise;
		} finally {
			this.highlightIndex = -1;
			this.isPlaying = false;
			this.abortPlayback = null;
		}
	};

	stopPlayback = () => {
		this.abortPlayback?.();
		this.abortPlayback = null;
		this.isPlaying = false;
		this.highlightIndex = -1;
	};

	previewQuizNote = async (noteIndex: number) => {
		const currentExercise = this.exercise;
		if (!currentExercise) return;

		pauseListening();
		try {
			await playNote(currentExercise.notes[noteIndex].midi, 0.4);
			await new Promise((resolve) => setTimeout(resolve, 200));
		} finally {
			resumeListening();
		}
	};

	applyTempoChange = () => {
		saveSettings(this.settings);
		if (this.exercise) {
			this.exercise.tempo = this.settings.tempo;
		}
	};
}

export function createExercisePageController() {
	return new ExercisePageController();
}
