# VM Training Media Operations

Este guia cobre a operação do catálogo v1.3. Descoberta e licença válida criam somente candidatos; nenhuma dessas etapas substitui revisão visual humana.

## 1. Discover

```bash
pnpm media:discover --dry-run
pnpm media:rediscover
```

Revise `data/media/media-candidates.json`, artefato sanitizado e versionado usado pelo sync de Production. `.tmp/media-candidates.json` permanece como saída operacional do discovery local. Consultas Wikimedia usam apenas HTTPS, hosts permitidos, redirects validados, limite de tamanho, retry e cache local.

## 2. Sync

```bash
pnpm media:sync-candidates
pnpm media:report
```

O sync é idempotente por `exercise_id + source_url`, preserva licença, fonte, score, razões e metadata, e grava `pending`, `media_role = null` e `execution_quality = unreviewed`.

## 3. Review and classify

Entre como Admin e abra `/admin/media-review`. Itens necessários por planos ativos recebem prioridade. Para PRIMARY_DEMO, confirme os dez itens do checklist, escolha trim e classifique como:

- `PRIMARY_DEMO`: execução usada no card e na ficha;
- `EDUCATIONAL`: dicas, erros ou explicações;
- `ALTERNATIVE_VARIATION`: outra forma de execução.

Vídeos de erros comuns são educacionais. Squat genérico não é primary de Hack/Smith; Chest Press não é primary de Fly; Chest Stretch não é Thoracic Extension.

## 4. Process

Valide o ambiente:

```bash
pnpm media:ffmpeg-check
```

Depois processe um item ou a fila revisada:

```bash
pnpm media:process-pending --media-id UUID
pnpm media:process-pending --exercise leg-press
pnpm media:process-pending --approved-for-processing
```

O pipeline baixa em workspace isolado, executa ffprobe, trim, remove áudio, limita a 720p/30 fps, gera MP4 H.264/yuv420p e poster WebP, calcula SHA-256, envia caminhos imutáveis por papel e limpa temporários em `finally`. Falhas preservam o candidato como `failed` com mensagem resumida; o Admin pode tentar novamente.

Processamento pesado deve ocorrer localmente/CLI, não em request comum da Vercel.

## 5. Approve and publish

Após processamento, compare source e final e clique em Publicar. A RPC server-side é a única operação autorizada a mudar `processed → approved`. Para PRIMARY_DEMO ela substitui a primary anterior de forma transacional e ativa o exercício apenas quando instruções, equipamento, movimento e músculos também estão completos.

## 6. Validate

```bash
pnpm media:production-report
pnpm media:validate
pnpm media:storage-check
pnpm media:licenses
pnpm exec supabase test db
pnpm release:check
```

Catalog Coverage é informativa. Um plano ativo só está pronto com 100% de Plan Coverage por PRIMARY_DEMO aprovada. Sem plano ativo, o relatório informa `No active plan — onboarding required`.

## 7. Upload and licensed packs

Upload próprio usa `source_type=self_produced`. Material comprado usa `licensed_pack` e deve preservar fornecedor, referência e documento de licença. O importador Vital só pode ler um pacote obtido legitimamente e uma EULA validada; ele nunca baixa o pacote.

O relatório legal aprovado é gerado em `docs/generated-media-licenses.md`.
