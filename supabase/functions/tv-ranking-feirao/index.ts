// tv-ranking-feirao — placar exclusivo do Desafio do Feirão (Amparo). Somente leitura.
// Vendas, propostas e pastas: >= ?start 00:00 e < (?end + 1 dia) 00:00, America/Sao_Paulo (padrão 18/11 → 22/11 00:00).
// Agendamentos: >= ?ag_start 00:00 e < (?ag_end + 1 dia) 00:00 (padrão segunda 16/11 → 22/11 00:00). Regras em core.js.
import { createClient } from "npm:@supabase/supabase-js@2";
import { eventWindow, tally, DEFAULT_AG_START, DEFAULT_AG_END } from "./core.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPANY_ID = "97b5f222-7d0a-47de-8518-2e3056d103a5";
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

async function allRows(table: string, columns: string, filter: (q: any) => any) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(supabase.from(table).select(columns).order("id")).range(from, from + 999);
    if (error) throw new Error(table + ": " + error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    if (rows.length > 20000) throw new Error("Limite de segurança excedido em " + table);
  }
  return rows;
}

async function buildData(params: URLSearchParams) {
  const w = eventWindow(params.get("start") || "", params.get("end") || "");
  const wa = eventWindow(params.get("ag_start") || "", params.get("ag_end") || "", DEFAULT_AG_START, DEFAULT_AG_END);
  const range = (col: string, win = w) => (q: any) => q.gte(col, win.startUtc).lt(col, win.endUtc);
  const [profiles, sold, proposals, folders, visits] = await Promise.all([
    allRows("profiles", "id,full_name,nome", (q) => q.eq("company_id", COMPANY_ID).eq("active", true)
      .in("role", ["broker", "corretor", "agent"]).eq("exclude_from_rankings", false)),
    allRows("leads", "id,owner_id,responsavel_id,sold_at", (q) => range("sold_at")(q.eq("company_id", COMPANY_ID).is("deleted_at", null))),
    allRows("proposals", "id,lead_id,assigned_to,created_at,ato_pago", (q) => range("created_at")(q.eq("company_id", COMPANY_ID).eq("ato_pago", true))),
    allRows("lead_folders", "id,lead_id,owner_id,submitted_at", (q) => range("submitted_at")(q.eq("company_id", COMPANY_ID))),
    allRows("calendar_events", "id,lead_id,corretor_id,corretor_name,start_at,created_at,status", (q) => range("created_at", wa)(q.eq("organization_id", COMPANY_ID))),
  ]);
  if (!profiles.length) throw new Error("Nenhum corretor ativo encontrado no Amparo");
  const leadIds = [...new Set(proposals.filter((x: any) => !x.assigned_to).map((x: any) => x.lead_id).filter(Boolean))];
  const leadOwner = new Map<string, string>();
  for (let i = 0; i < leadIds.length; i += 200) {
    const { data } = await supabase.from("leads").select("id,owner_id,responsavel_id").in("id", leadIds.slice(i, i + 200));
    for (const l of data || []) leadOwner.set(l.id, l.owner_id || l.responsavel_id);
  }
  const result = tally({ profiles, sold, proposals, folders, visits, leadOwner, window: w, agWindow: wa });
  return {
    campaign: { start: w.start, end: w.end, startUtc: w.startUtc, endUtcExclusive: w.endUtc,
      agendamentos: { start: wa.start, end: wa.end, startUtc: wa.startUtc, endUtcExclusive: wa.endUtc } },
    ...result, updatedAt: new Date().toISOString(), complete: true, source: "Amparo CRM",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405, headers: cors });
  try {
    const data = await buildData(new URL(req.url).searchParams);
    return new Response(JSON.stringify(data), { status: 200, headers: { ...cors, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("tv-ranking-feirao", error);
    return new Response(JSON.stringify({ error: "Não foi possível consultar os indicadores do Amparo" }), {
      status: 500, headers: { ...cors, "Cache-Control": "no-store" },
    });
  }
});
