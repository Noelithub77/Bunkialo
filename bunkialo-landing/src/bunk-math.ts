// Mirrors `selectCourseStats` in the app's `src/stores/bunk-store-helpers.ts`.

/** Empirical semester bunk estimate from repeated calculations, not an official allowance. */
export const budget = (credits: number): number => 2 * credits + 1;

/** Classes attended above the 80% line; negative when below it. */
export const buffer = (held: number, attended: number): number => attended - Math.ceil(held * 0.8);
