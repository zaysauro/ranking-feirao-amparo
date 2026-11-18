/**
 * Ranking do Desafio do Feirão — ponte servidor a servidor para a Edge Function
 * `tv-ranking-feirao` do Amparo (Supabase). A chave fica só no servidor.
 *
 * Variáveis (Vercel › Settings › Environment Variables):
 *   SUPABASE_URL, SUPABASE_ANON_KEY          (obrigatórias — mesmas do Amparo)
 *   FEIRAO_INICIO, FEIRAO_FIM                (período único do placar, para TODAS as métricas, padrão 2026-11-18 → 2026-11-21:
 *                                             conta data >= 18/11 00:00 e < 22/11 00:00, America/Sao_Paulo; o filtro é feito no backend)
 *   FEIRAO_DIA_INICIO, FEIRAO_DIA_FIM        (só o visual: contagem regressiva e datas no topo da tela) padrão 2026-11-20 → 2026-11-21
 *   FEIRAO_PONTOS                            (venda,proposta,pasta,agendamento) padrão "10,5,3,2"
 *   FEIRAO_META_AGENDAMENTOS                 (meta da equipe de clientes agendados p/ o feirão) padrão 50
 */
const TIMEOUT_MS = 15000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const env = (k, d) => {
  const v = String(process.env[k] || '').trim();
  return v || d;
};
const day = (k, d) => (DAY.test(env(k, d)) ? env(k, d) : d);

function config() {
  const pts = env('FEIRAO_PONTOS', '10,5,3,2').split(',').map((x) => Math.max(0, Number(x) || 0));
  const [vendas = 10, propostas = 5, pastas = 3, agendamentos = 2] = pts;
  return {
    start: day('FEIRAO_INICIO', '2026-11-18'),
    end: day('FEIRAO_FIM', '2026-11-21'),
    eventStart: day('FEIRAO_DIA_INICIO', '2026-11-20'),
    eventEnd: day('FEIRAO_DIA_FIM', '2026-11-21'),
    points: { vendas, propostas, pastas, agendamentos },
    goal: Math.max(1, Number(env('FEIRAO_META_AGENDAMENTOS', '50')) || 50),
  };
}

const n = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0);
const METRICS = ['vendas', 'propostas', 'pastas', 'agendamentos'];

function score(data, cfg) {
  const ranking = (Array.isArray(data.ranking) ? data.ranking : []).map((p) => {
    const row = { name: String(p.name || 'Corretor').slice(0, 80) };
    for (const m of METRICS) row[m] = n(p[m]);
    row.pontos = METRICS.reduce((s, m) => s + row[m] * cfg.points[m], 0);
    return row;
  });
  ranking.sort((a, b) =>
    b.pontos - a.pontos || b.vendas - a.vendas || b.propostas - a.propostas ||
    b.pastas - a.pastas || b.agendamentos - a.agendamentos || a.name.localeCompare(b.name, 'pt-BR'));
  ranking.forEach((p, i) => { p.posicao = i + 1; });
  const totals = {};
  for (const m of METRICS) totals[m] = ranking.reduce((s, p) => s + p[m], 0);
  totals.pontos = ranking.reduce((s, p) => s + p.pontos, 0);
  const feed = (Array.isArray(data.feed) ? data.feed : []).slice(0, 15)
    .filter((f) => METRICS.includes(f && f.type) && !Number.isNaN(Date.parse(f.at)))
    .map((f) => ({ name: String(f.name || '').slice(0, 80), type: f.type, at: f.at }));
  return {
    campaign: { start: cfg.start, end: cfg.end, eventStart: cfg.eventStart, eventEnd: cfg.eventEnd },
    points: cfg.points, goal: cfg.goal, ranking, totals, feed,
    updatedAt: data.updatedAt || new Date().toISOString(), complete: data.complete !== false,
  };
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  const baseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) return res.status(503).json({ error: 'Integração com o Amparo não configurada' });

  const cfg = config();
  try {
    const endpoint = new URL('/functions/v1/tv-ranking-feirao', baseUrl);
    endpoint.searchParams.set('start', cfg.start);
    endpoint.searchParams.set('end', cfg.end);
    const response = await fetch(endpoint, {
      headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      console.error('[feirao-amparo]', response.status, data && data.error);
      return res.status(502).json({ error: 'Não foi possível atualizar os dados do Amparo', retryable: true });
    }
    return res.status(200).json(score(data, cfg));
  } catch (error) {
    console.error('[feirao-amparo]', error.message);
    return res.status(502).json({ error: 'Amparo temporariamente indisponível', retryable: true });
  }
}

module.exports = handler;
module.exports.score = score;
module.exports.config = config;
