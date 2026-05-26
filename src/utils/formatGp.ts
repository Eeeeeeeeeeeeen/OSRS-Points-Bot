export function formatGp(gp: number): string {
    if (gp >= 1_000_000_000) return `${(gp / 1_000_000_000).toFixed(1)}b GP`;
    if (gp >= 1_000_000)     return `${(gp / 1_000_000).toFixed(1)}m GP`;
    if (gp >= 1_000)         return `${(gp / 1_000).toFixed(1)}k GP`;
    return `${gp} GP`;
}
