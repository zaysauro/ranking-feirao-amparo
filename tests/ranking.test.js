const assert = require('node:assert/strict');
const { score, config } = require('../api/ranking.js');
const cfg = config();
const out = score({
  ranking: [
    { name: 'A', vendas: 0, propostas: 0, pastas: 0, agendamentos: 9 },
    { name: 'B', vendas: 1, propostas: 0, pastas: 0, agendamentos: 0 },
    { name: 'C', vendas: 0, propostas: 1, pastas: 2, agendamentos: 1 },
  ],
  feed: [{ name: 'B', type: 'vendas', at: '2026-11-20T12:00:00Z' }, { name: 'X', type: 'hack', at: 'x' }],
}, cfg);
assert.deepEqual(out.ranking.map((p) => [p.name, p.pontos]), [['A', 18], ['C', 13], ['B', 10]]);
assert.equal(out.totals.agendamentos, 10);
assert.equal(out.feed.length, 1);
assert.equal(out.campaign.eventStart, '2026-11-20');
console.log('PASS: pontuação, ordenação, totais e feed');
