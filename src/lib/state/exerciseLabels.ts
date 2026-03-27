import { m } from '$lib/paraglide/messages.js';

export function keySignatureLabel(sharps: number, flats: number): string {
	const keyNames: Record<string, () => string> = {
		's0': m.key_c_major,
		's1': m.key_g_major,
		's2': m.key_d_major,
		's3': m.key_a_major,
		's4': m.key_e_major,
		's5': m.key_b_major,
		's6': m.key_f_sharp_major,
		's7': m.key_c_sharp_major,
		'f1': m.key_f_major,
		'f2': m.key_b_flat_major,
		'f3': m.key_e_flat_major,
		'f4': m.key_a_flat_major,
		'f5': m.key_d_flat_major,
		'f6': m.key_g_flat_major,
		'f7': m.key_c_flat_major
	};

	if (flats > 0) return keyNames[`f${flats}`]?.() ?? m.n_flats({ count: flats });
	return keyNames[`s${sharps}`]?.() ?? m.n_sharps({ count: sharps });
}

export const intervalLabels: Record<number, () => string> = {
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
