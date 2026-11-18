// Regras de contagem do Desafio do Feirão — puras, sem banco, para testar as bordas.
// Período único para TODAS as métricas: data >= início 00:00:00 e data < (fim + 1 dia) 00:00:00,
// no fuso America/Sao_Paulo (UTC-03:00, sem horário de verão desde 2019).

export const TZ_OFFSET = "-03:00";
export const DEFAULT_START = "2026-11-18";
export const DEFAULT_END = "2026-11-21"; // inclusivo: o sábado inteiro; o limite exclusivo é 22/11 00:00
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(day, n) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function eventWindow(start, end) {
  let s = DAY.test(start || "") ? start : DEFAULT_START;
  let e = DAY.test(end || "") ? end : DEFAULT_END;
  if (e < s) { s = DEFAULT_START; e = DEFAULT_END; }
  if ((Date.parse(e) - Date.parse(s)) / 864e5 > 45) e = addDays(s, 45);
  return {
    start: s, end: e,
    startUtc: new Date(s + "T00:00:00" + TZ_OFFSET).toISOString(),
    endUtc: new Date(addDays(e, 1) + "T00:00:00" + TZ_OFFSET).toISOString(), // exclusivo
  };
}

export function inWindow(value, w) {
  if (!value) return false;
  const t = Date.parse(value);
  return Number.isFinite(t) && t >= Date.parse(w.startUtc) && t < Date.parse(w.endUtc);
}

export const isCanceled = (status) => /cancel|desmarc|reagendad|exclu/i.test(String(status || ""));
export const normalize = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Conta o placar. Entradas já vêm do banco filtradas pelo período, mas cada linha é checada
 * de novo aqui (defesa em profundidade) e duplicidades são descartadas:
 *  - vendas: 1 por lead (sold_at no período)
 *  - propostas: só ato pago, 1 por lead (created_at no período)
 *  - pastas: 1 por lead (submitted_at no período)
 *  - agendamentos: registro criado no período (created_at), sem cancelados/desmarcados/reagendados,
 *    1 por (lead, corretor, horário da visita); sem lead, 1 por id
 * O ponto vai para o corretor responsável, e só corretores elegíveis (lista de perfis) pontuam.
 */
export function tally({ profiles, sold, proposals, folders, visits, leadOwner = new Map(), window: w }) {
  const nameOf = (p) => p.full_name || p.nome || "Corretor";
  const team = new Map(profiles.map((p) => [p.id, { name: nameOf(p), vendas: 0, propostas: 0, pastas: 0, agendamentos: 0 }]));
  const byName = new Map(profiles.map((p) => [normalize(nameOf(p)), p.id]));
  const feed = [];
  const seen = { vendas: new Set(), propostas: new Set(), pastas: new Set(), agendamentos: new Set() };
  const add = (id, metric, dedupeKey, at) => {
    const person = id ? team.get(id) : null;
    if (!person || seen[metric].has(dedupeKey)) return;
    seen[metric].add(dedupeKey);
    person[metric] += 1;
    if (at) feed.push({ name: person.name, type: metric, at });
  };
  for (const l of sold) if (inWindow(l.sold_at, w)) add(l.owner_id || l.responsavel_id, "vendas", "lead:" + l.id, l.sold_at);
  for (const p of proposals) {
    if (p.ato_pago !== true || !inWindow(p.created_at, w)) continue;
    add(p.assigned_to || leadOwner.get(p.lead_id), "propostas", p.lead_id ? "lead:" + p.lead_id : "id:" + p.id, p.created_at);
  }
  for (const f of folders) if (inWindow(f.submitted_at, w)) add(f.owner_id, "pastas", f.lead_id ? "lead:" + f.lead_id : "id:" + f.id, f.submitted_at);
  for (const v of visits) {
    if (isCanceled(v.status) || !inWindow(v.created_at, w)) continue;
    const owner = v.corretor_id || byName.get(normalize(v.corretor_name));
    const key = v.lead_id ? ["lead", v.lead_id, owner, v.start_at].join(":") : "id:" + v.id;
    add(owner, "agendamentos", key, v.created_at);
  }
  const ranking = [...team.values()].sort((a, b) =>
    b.vendas - a.vendas || b.propostas - a.propostas || b.pastas - a.pastas || b.agendamentos - a.agendamentos ||
    a.name.localeCompare(b.name, "pt-BR"));
  const totals = { vendas: 0, propostas: 0, pastas: 0, agendamentos: 0 };
  for (const p of ranking) for (const k in totals) totals[k] += p[k];
  feed.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { ranking, totals, feed: feed.slice(0, 15) };
}
