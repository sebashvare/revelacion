// Porcentajes de la barra de resultados. Puro, sin DOM ni red: por eso es
// lo único con test (test/tally.test.mjs).
export function tally(counts) {
  const nino = counts['niño'] || 0;
  const nina = counts['niña'] || 0;
  const total = nino + nina;
  if (total === 0) return { nino, nina, total, ninoPct: 50, ninaPct: 50, empty: true };
  const ninoPct = Math.round((nino / total) * 100);
  return { nino, nina, total, ninoPct, ninaPct: 100 - ninoPct, empty: false };
}
