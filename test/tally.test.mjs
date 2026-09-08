import assert from 'node:assert/strict';
import { tally } from '../src/tally.js';

assert.deepEqual(tally({}), { nino: 0, nina: 0, total: 0, ninoPct: 50, ninaPct: 50, empty: true });
assert.deepEqual(tally({ 'niño': 3, 'niña': 1 }).ninoPct, 75);
// los dos lados siempre suman 100, incluso con redondeo feo (1/3)
const t = tally({ 'niño': 1, 'niña': 2 });
assert.equal(t.ninoPct + t.ninaPct, 100);
assert.equal(t.ninoPct, 33);
assert.equal(tally({ 'niña': 5 }).ninoPct, 0);
console.log('tally ok');
