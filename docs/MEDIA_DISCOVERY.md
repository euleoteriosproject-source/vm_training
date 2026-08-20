# Media Discovery v1.2

## Fluxo

```text
exercise + aliases + equipment + movement + muscles
  → query builder
  → Wikimedia multi-query
  → verified category crawler
  → CDC strategy
  → per-file metadata and license validation
  → deterministic score with penalties
  → pending candidate
  → individual human review
```

Discovery nunca escreve `approved`. O arquivo externo somente é baixado, convertido e enviado ao Storage depois da seleção administrativa.

## Queries e aliases

`buildExerciseSearchQueries()` combina nome inglês, aliases persistidos, vocabulário curado, equipamento, músculo e termos de demonstração. Queries são normalizadas e deduplicadas, com limite padrão de 12 por exercício e 15 resultados por query.

O comando normal conectado procura exercícios sem candidato. Use `--missing-only` explicitamente em dry-run, ou `--force` para revalidar exercícios já cobertos.

## Categorias e CDC

O crawler valida cada categoria via `categoryinfo` antes de percorrê-la. A profundidade padrão é 2 e `MAX_CATEGORY_ITEMS` impede enumeração ilimitada. Categorias iniciais:

- Videos of people demonstrating strength training exercises
- CDC videos about physical activity
- Weight training
- Physical exercise

`discoverCdcExerciseMedia()` pesquisa a coleção por diferentes descrições, mas a origem confiável apenas adiciona pontos depois que a licença específica do arquivo foi lida.

## Score

Sinais positivos incluem nome, alias, overlap de título, equipamento, movimento, músculo, categoria, palavra de demonstração, coleção CDC e formato de vídeo. Penalidades cobrem equipamento errado, subtipo diferente, movimento diferente, título genérico e conteúdo não relacionado a exercício.

```text
85–100  strong candidate
70–84   candidate
55–69   low confidence / manual discovery
<55     ignored
```

O score mede correspondência textual/contextual. Somente o Admin pode avaliar a execução visual.

## Cache, segurança e artefatos

- User-Agent identificável, até quatro requisições concorrentes e espaçamento global.
- Retry exponencial, `Retry-After`, timeout e cache de metadata com TTL de 24 horas.
- Preview/download continua restrito a `commons.wikimedia.org` e `upload.wikimedia.org`.
- `.tmp/media-candidates.json` permite discovery e relatório sem Supabase; a cópia sanitizada `data/media/media-candidates.json` preserva os 40 candidatos necessários para sincronização em Production.
- `docs/generated-media-discovery-report.md` registra queries, resultados, candidatos, score e motivo de ausência.

## Missing reasons

`no_results`, `no_video`, `no_licensed_results`, `low_match_score`, `wrong_equipment`, `ambiguous` ou `discovery_error`. Nenhum exercício pesquisado deve permanecer `missing` sem um desses motivos.

## Comandos

```bash
pnpm media:discover --dry-run
pnpm media:discover --dry-run --missing-only
pnpm media:discover --dry-run --exercise face-pull
pnpm media:discover --dry-run --output candidates.json
pnpm media:rediscover
pnpm media:report
```
