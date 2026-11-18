// Testes de borda do período do Feirão: node tests/periodo.test.mjs
import assert from 'node:assert/strict';
import { eventWindow, inWindow, tally, DEFAULT_AG_START, DEFAULT_AG_END } from '../supabase/functions/tv-ranking-feirao/core.js';

const w = eventWindow('2026-11-18', '2026-11-21');
assert.equal(w.startUtc, '2026-11-18T03:00:00.000Z'); // 18/11 00:00 Brasília
assert.equal(w.endUtc, '2026-11-22T03:00:00.000Z');   // 22/11 00:00 Brasília (exclusivo)
assert.deepEqual(eventWindow('', ''), w, 'padrão = 18 a 21/11');

const br = (s) => s + '-03:00'; // horário de Brasília
const casos = [
  ['terça 17/11 23:59:59', br('2026-11-17T23:59:59'), false],
  ['terça 17/11 22:35 (gravado como 18/11 01:35 UTC — caso real)', '2026-11-18T01:35:04.866Z', false],
  ['quarta 18/11 00:00:00 (início, inclusivo)', br('2026-11-18T00:00:00'), true],
  ['quarta 18/11 13:19', br('2026-11-18T13:19:00'), true],
  ['quinta 19/11 10:00', br('2026-11-19T10:00:00'), true],
  ['sexta 20/11 18:00', br('2026-11-20T18:00:00'), true],
  ['sábado 21/11 23:59:59.999', br('2026-11-21T23:59:59.999'), true],
  ['domingo 22/11 00:00:00 (término, exclusivo)', br('2026-11-22T00:00:00'), false],
  ['domingo 22/11 09:00', br('2026-11-22T09:00:00'), false],
  ['vazio', null, false],
];
for (const [nome, valor, esperado] of casos) {
  assert.equal(inWindow(valor, w), esperado, nome);
  console.log((esperado ? 'conta   ' : 'fora    ') + '✓ ' + nome);
}

// Placar com uma linha por dia em cada métrica
const profiles = [{ id: 'A', full_name: 'Ana' }, { id: 'B', full_name: 'Bia' }];
const dias = casos.filter(([, v]) => v).map(([, v], i) => ({ i, v }));
const r = tally({
  window: w, profiles,
  sold: dias.map(({ i, v }) => ({ id: 'L' + i, owner_id: 'A', sold_at: v })),
  proposals: [
    ...dias.map(({ i, v }) => ({ id: 'P' + i, lead_id: 'PL' + i, assigned_to: 'A', created_at: v, ato_pago: true })),
    { id: 'Psem', lead_id: 'X1', assigned_to: 'A', created_at: br('2026-11-19T10:00:00'), ato_pago: false }, // sem ato pago
    { id: 'Pdup', lead_id: 'PL3', assigned_to: 'A', created_at: br('2026-11-19T11:00:00'), ato_pago: true }, // mesmo lead
  ],
  folders: [
    ...dias.map(({ i, v }) => ({ id: 'F' + i, lead_id: 'FL' + i, owner_id: 'B', submitted_at: v })),
    { id: 'Fdup', lead_id: 'FL3', owner_id: 'B', submitted_at: br('2026-11-20T09:00:00') }, // mesma pasta reenviada
  ],
  visits: [
    ...dias.map(({ i, v }) => ({ id: 'V' + i, lead_id: 'VL' + i, corretor_id: 'B', start_at: br('2026-11-21T10:00:00'), created_at: v, status: 'agendada' })),
    { id: 'Vdup', lead_id: 'VL3', corretor_id: 'B', start_at: br('2026-11-21T10:00:00'), created_at: br('2026-11-19T12:00:00'), status: 'agendada' }, // duplicado
    { id: 'Vcanc', lead_id: 'VX', corretor_id: 'B', start_at: br('2026-11-21T10:00:00'), created_at: br('2026-11-19T12:00:00'), status: 'Cancelada' },
    { id: 'Vnome', lead_id: 'VY', corretor_name: 'bia', start_at: br('2026-11-20T15:00:00'), created_at: br('2026-11-20T08:00:00'), status: 'agendada' }, // só pelo nome
    { id: 'Vout', lead_id: 'VZ', corretor_id: 'Z', start_at: br('2026-11-20T15:00:00'), created_at: br('2026-11-20T08:00:00') }, // inelegível
  ],
});
const A = r.ranking.find((p) => p.name === 'Ana'), B = r.ranking.find((p) => p.name === 'Bia');
// quarta 00:00, quarta 13:19, quinta, sexta, sábado 23:59:59.999 = 5 registros no período
assert.equal(A.vendas, 5, 'vendas: só quarta a sábado');
assert.equal(A.propostas, 5, 'propostas: só ato pago no período, 1 por lead');
assert.equal(B.pastas, 5, 'pastas: 1 por lead no período');
assert.equal(B.agendamentos, 6, 'agendamentos: 5 no período + 1 pelo nome; sem duplicado, cancelado ou inelegível');
assert.deepEqual(r.totals, { vendas: 5, propostas: 5, pastas: 5, agendamentos: 6 });
console.log('PASS: período 18/11 00:00 → 22/11 00:00 (Brasília), duplicidades, cancelados e elegibilidade');

// Agendamentos: semana do feirão, segunda 16/11 00:00 → sábado 21/11 (exclusivo 22/11 00:00)
const wa = eventWindow('', '', DEFAULT_AG_START, DEFAULT_AG_END);
assert.equal(wa.startUtc, '2026-11-16T03:00:00.000Z');
assert.equal(wa.endUtc, '2026-11-22T03:00:00.000Z');
const ag = [
  ['domingo 15/11 23:59:59', br('2026-11-15T23:59:59'), false],
  ['segunda 16/11 00:00:00 (início, inclusivo)', br('2026-11-16T00:00:00'), true],
  ['terça 17/11 14:39', br('2026-11-17T14:39:00'), true],
  ['quarta 18/11 13:19', br('2026-11-18T13:19:00'), true],
  ['sábado 21/11 23:59:59', br('2026-11-21T23:59:59'), true],
  ['domingo 22/11 00:00:00 (término, exclusivo)', br('2026-11-22T00:00:00'), false],
  ['quarta 11/11 (semana passada)', br('2026-11-11T14:53:00'), false],
];
const r2 = tally({
  window: w, agWindow: wa, profiles,
  sold: [{ id: 'Lseg', owner_id: 'A', sold_at: br('2026-11-16T10:00:00') }], // venda de segunda: fora (período 18–21)
  proposals: [],
  folders: [{ id: 'Fter', lead_id: 'FX', owner_id: 'B', submitted_at: br('2026-11-17T10:00:00') }], // pasta de terça: fora
  visits: ag.map(([, v], i) => ({ id: 'AG' + i, lead_id: 'AGL' + i, corretor_id: 'B', start_at: br('2026-11-20T10:00:00'), created_at: v, status: 'agendada' })),
});
for (const [nome, , esperado] of ag) console.log((esperado ? 'conta   ' : 'fora    ') + '✓ agendamento ' + nome);
assert.deepEqual(r2.totals, { vendas: 0, propostas: 0, pastas: 0, agendamentos: ag.filter((x) => x[2]).length });
console.log('PASS: agendamentos de segunda 16/11 a sábado 21/11; vendas, propostas e pastas seguem 18 a 21/11');
