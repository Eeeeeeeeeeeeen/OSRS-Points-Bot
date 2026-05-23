const POINTS_PER_MILLION = 1;
const MIN_POINTS_PER_PERSON = 1;
const MAX_POINTS = 200;
const MIN_GP_VALUE = 1_000_000;

export function isEligibleDrop(gpValue: number): boolean {
    return gpValue >= MIN_GP_VALUE;
}

export function calculatePoints(gpValue: number, teamSize: number): number {
    const valuePerPerson = gpValue / teamSize;
    const raw = (valuePerPerson / 1_000_000) * POINTS_PER_MILLION;
    const perPerson = Math.floor(Math.min(raw, MAX_POINTS));
    return Math.max(perPerson, MIN_POINTS_PER_PERSON);
}
