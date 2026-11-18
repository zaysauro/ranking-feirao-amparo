# Desafio do Feirão — Amparo Imobiliária (TV)

Tela de ranking do feirão **Feriado da Chave Certa** (20 e 21/11) com a identidade Amparo.
Projeto novo e independente do `ranking-mcmv-tv` — mesma lógica: o corretor lança no Amparo e conta aqui.

## Como funciona
- `index.html` — tela da TV (pódio em arcos, disputa, meta da equipe, ticker ao vivo). Alterna **ranking (120 s)** ↔ **regras do desafio (20 s)**. Atualiza a cada 60 s.
  Quando entra **venda** ou **proposta** nova, aparece uma comemoração em tela cheia com o nome do corretor.
- `api/ranking.js` — ponte servidor a servidor para a Edge Function `tv-ranking-feirao` do Supabase Amparo e cálculo de pontos.
- Edge Function `tv-ranking-feirao` (Supabase Amparo) — nova, só leitura; **não altera a `tv-ranking`**.

## Pontuação (padrão)
**Placar exclusivo do Feirão**, filtrado no backend (Edge Function `tv-ranking-feirao`), no fuso America/Sao_Paulo:
- **Vendas, propostas e pastas:** data **>= 18/11/2026 00:00:00 e < 22/11/2026 00:00:00** (quarta a sábado).
- **Agendamentos:** data do registro **>= 16/11/2026 00:00:00 e < 22/11/2026 00:00:00** (segunda a sábado da semana do feirão).

| Ação no Amparo | Pontos | Data que conta |
|---|---|---|
| Venda | 10 | `sold_at` (1 por lead) |
| Proposta com ato pago | 5 | `created_at` da proposta (1 por lead) |
| Pasta enviada | 3 | `submitted_at` (1 por lead) |
| Agendamento | 2 | `created_at` do evento na agenda (canceladas/desmarcadas/reagendadas não contam; mesmo cliente + corretor + horário conta 1 vez) |

O ponto vai para o corretor responsável e só corretores elegíveis (ativos e não excluídos dos rankings) pontuam. Desempate: vendas > propostas > pastas > agendamentos.

Código da função: `supabase/functions/tv-ranking-feirao/` (regras em `core.js`). Testes de borda (vendas/propostas/pastas: terça e domingo fora, quarta a sábado dentro; agendamentos: domingo 15/11 e domingo 22/11 fora, segunda a sábado dentro): `node tests/periodo.test.mjs`.

## Variáveis (Vercel › Settings › Environment Variables)
| Variável | Padrão |
|---|---|
| `SUPABASE_URL` | — (obrigatória) |
| `SUPABASE_ANON_KEY` | — (obrigatória) |
| `FEIRAO_INICIO` / `FEIRAO_FIM` (vendas, propostas e pastas; fim inclusivo) | `2026-11-18` / `2026-11-21` |
| `FEIRAO_AGEND_INICIO` / `FEIRAO_AGEND_FIM` (agendamentos; fim inclusivo) | `2026-11-16` / `2026-11-21` |
| `FEIRAO_DIA_INICIO` / `FEIRAO_DIA_FIM` (só a contagem regressiva no topo) | `2026-11-20` / `2026-11-21` |
| `FEIRAO_PONTOS` | `10,5,3,2` (venda, proposta, pasta, agendamento) |
| `FEIRAO_META_AGENDAMENTOS` | `50` |

Para o próximo feirão, basta trocar as datas.

## Atalhos
- `?tela=desafio` abre direto na tela de regras · `?demo=venda` testa a comemoração.
- Fotos: `photos/Nome_Sobrenome.jpg`. O nome do arquivo é o nome exibido; o corretor do Amparo é reconhecido pelo primeiro nome (lista `ROSTER` no `index.html`, ex.: "Pedro Kauan" → Kauan Pereira). Corretor novo: adicione a foto e uma linha na lista.

Testes: `node tests/ranking.test.js` e `node tests/periodo.test.mjs`
