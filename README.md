# Desafio do Feirão — Amparo Imobiliária (TV)

Tela de ranking do feirão **Feriado da Chave Certa** (20 e 21/11) com a identidade Amparo.
Projeto novo e independente do `ranking-mcmv-tv` — mesma lógica: o corretor lança no Amparo e conta aqui.

## Como funciona
- `index.html` — tela da TV (pódio em arcos, disputa, meta da equipe, ticker ao vivo). Alterna **ranking (120 s)** ↔ **regras do desafio (20 s)**. Atualiza a cada 60 s.
  Quando entra **venda** ou **proposta** nova, aparece uma comemoração em tela cheia com o nome do corretor.
- `api/ranking.js` — ponte servidor a servidor para a Edge Function `tv-ranking-feirao` do Supabase Amparo e cálculo de pontos.
- Edge Function `tv-ranking-feirao` (Supabase Amparo) — nova, só leitura; **não altera a `tv-ranking`**.

## Pontuação (padrão)
| Ação no Amparo | Pontos | Conta quando |
|---|---|---|
| Venda (`sold_at`) | 10 | dentro do período da campanha |
| Proposta com ato pago | 5 | criada no período da campanha |
| Pasta enviada (`submitted_at`) | 3 | no período da campanha |
| Cliente agendado para o feirão | 2 | visita marcada **para os dias do feirão** (canceladas não contam) |

Desempate: vendas > propostas > pastas > agendamentos.

## Variáveis (Vercel › Settings › Environment Variables)
| Variável | Padrão |
|---|---|
| `SUPABASE_URL` | — (obrigatória) |
| `SUPABASE_ANON_KEY` | — (obrigatória) |
| `FEIRAO_INICIO` / `FEIRAO_FIM` | `2026-11-18` / `2026-11-21` |
| `FEIRAO_DIA_INICIO` / `FEIRAO_DIA_FIM` | `2026-11-20` / `2026-11-21` |
| `FEIRAO_PONTOS` | `10,5,3,2` (venda, proposta, pasta, agendamento) |
| `FEIRAO_META_AGENDAMENTOS` | `50` |

Para o próximo feirão, basta trocar as datas.

## Atalhos
- `?tela=desafio` abre direto na tela de regras · `?demo=venda` testa a comemoração.
- Fotos: `photos/Nome_Sobrenome.jpg`. O nome do arquivo é o nome exibido; o corretor do Amparo é reconhecido pelo primeiro nome (lista `ROSTER` no `index.html`, ex.: "Pedro Kauan" → Kauan Pereira). Corretor novo: adicione a foto e uma linha na lista.

Teste: `node tests/ranking.test.js`
