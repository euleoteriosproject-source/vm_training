# VM Training

Aplicação privada, mobile-first, para planejamento, execução e acompanhamento de treinos. O frontend usa Next.js 16/App Router; autenticação, PostgreSQL, RLS e arquivos usam Supabase. O deploy alvo é Vercel.

## O que está implementado

- Auth por e-mail/senha com confirmação, recuperação, logout, sessão SSR e exclusão com reautenticação.
- Allowlist server-side por endereço completo no `Before User Created Hook`.
- Onboarding em cinco etapas, objetivos ordenados, rotina, experiência e equipamentos.
- Gerador determinístico por objetivo, frequência, tempo, cardio, experiência, equipamentos e preferências.
- Planos independentes e versionados; um novo plano arquiva o anterior sem apagar histórico.
- Execução série a série, autosave otimista, timer, cardio, skip, substituição e resumo.
- Fila IndexedDB para séries durante falha de rede, sincronizada ao reconectar.
- Medidas, histórico, frequência semanal e gráficos de progresso.
- Admin de exercícios, equipamentos, allowlist e upload/aprovação de mídia.
- Dark/light/system, navegação mobile, sheets, skeletons, reduced motion e estados de erro.
- Migrations completas, RLS privada/global, storage privado, seed, pgTAP, Vitest e Playwright.

## Requisitos

- Node.js 22+
- pnpm 11+
- Docker Desktop
- Supabase CLI (incluída como dependência de desenvolvimento)

## Desenvolvimento local

```bash
pnpm install
cp .env.example .env.local
pnpm exec supabase start
pnpm db:reset
pnpm dev
```

Copie para `.env.local` a URL e a publishable key exibidas por `supabase status`. Não use a secret key em variável `NEXT_PUBLIC_*`.

## Variáveis

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SECRET_KEY` é lida somente em código server-side e nos CLIs operacionais. Nunca use o prefixo `NEXT_PUBLIC_` nela.

## Production Supabase Setup

1. Crie o projeto hospedado e copie URL, publishable key e secret key para o ambiente seguro.
2. Vincule o CLI com `pnpm exec supabase link --project-ref REF` e aplique as migrations com `pnpm exec supabase db push`.
3. Execute o seed somente no ambiente pretendido; ele mantém na allowlist de produção apenas `vinicius.euleoterio@hotmail.com` e `lisepaiva@hotmail.com`.
4. Em Authentication → Hooks, configure o Before User Created Hook como `public.hook_restrict_signup`.
5. Configure Site URL, `/auth/callback` e `/update-password` para o domínio final.
6. Confirme que o bucket privado `exercise-media` existe e execute os testes RLS antes do sync.
7. Rode `pnpm media:sync-candidates`, revise em `/admin/media-review`, processe localmente e publique somente após o preview final.

Para Vercel, cadastre as quatro variáveis somente no ambiente correto. Production deve ser pública na camada Vercel; a autenticação é responsabilidade do Supabase. Preview pode continuar protegido. Este repositório não faz link/deploy automaticamente sem as credenciais e a confirmação do projeto alvo.

## Banco, Auth e Storage

```bash
pnpm exec supabase migration up
pnpm db:reset
pnpm exec supabase test db
```

Toda migration futura que criar um objeto acessivel pela Data API deve declarar
o contrato completo no mesmo arquivo: `CREATE OBJECT` -> defaults seguros ou
`REVOKE` -> RLS/policies quando aplicavel -> `GRANT` somente para os roles e
operacoes necessarios. Nao dependa dos defaults do Supabase Hosted para expor
tabelas, sequences ou functions. Enquanto o historico remoto deste projeto nao
for reconciliado, nao execute `db push` em Production; siga o runbook versionado
em `ops/production/`.

As migrations criam schema, constraints, índices, policies, funções e o bucket privado `exercise-media`. O arquivo `supabase/config.toml` habilita localmente o hook `before_user_created`. Em um projeto hospedado, confirme em **Authentication → Hooks** que `public.hook_restrict_signup` está selecionada e configure:

- Site URL: a URL pública de produção;
- Redirect URLs: `https://SEU-DOMINIO/auth/callback` e `https://SEU-DOMINIO/update-password`;
- localhost equivalente para desenvolvimento.

O seed cadastra apenas metadados e instruções. Exercícios começam inativos de propósito: a constraint do banco só permite ativá-los depois que houver vídeo/GIF correspondente e aprovado. Faça upload pela área Admin usando apenas conteúdo próprio ou licenciado, com MP4/H.264 ou WebM e poster WebP.

## Qualidade

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Os testes E2E públicos rodam sem credenciais. Para o fluxo real de Auth, use um projeto Supabase de teste e informe `E2E_TEST_EMAIL` e `E2E_TEST_PASSWORD` exclusivamente pelo ambiente local/CI. Nunca versione essas credenciais. Os testes de isolamento real entre usuários estão em `supabase/tests/rls.sql`.

## Release readiness v1.4

```bash
# Engenharia local; aceita catálogo e planos ainda incompletos
pnpm release:check --mode local

# Gates rigorosos de produção
pnpm release:report --mode production
pnpm release:check --mode production

# Smoke anônimo do domínio público
PRODUCTION_URL=https://seu-dominio pnpm smoke:production
```

O gerador cria primeiro um plano `draft`. O PostgreSQL só permite ativá-lo — e só permite iniciar um treino — quando todos os exercícios planejados estão ativos e possuem `PRIMARY_DEMO` processada, revisada e aprovada. O endpoint `/api/health` publica apenas estado, versão, ambiente e commit abreviado; nunca retorna chaves ou dados de usuários.

## Deploy

1. Crie o projeto Supabase e execute `supabase link --project-ref ...` e `supabase db push`.
2. Configure o Auth Hook, URLs de Auth e envie/aprove as mídias licenciadas.
3. Importe o repositório na Vercel, usando `main` como Production.
4. Cadastre as quatro variáveis de ambiente; a secret key fica somente no ambiente server-side.
5. Desative Deployment Protection/Vercel Authentication para o domínio de produção. Preview pode permanecer protegido.
6. Valide signup dos dois e-mails, rejeição de terceiro e os viewports 360, 390, 430, 768, 1024 e 1440 px.

## Importação futura

`scripts/import-exercises.ts` aceita apenas metadados em JSON e rejeita qualquer campo de mídia. Licenças de vídeo devem ser verificadas manualmente antes do upload.

## Exercise Media

A biblioteca aceita apenas domínio público, CC0, CC BY 3/4, CC BY-SA 3/4, pacotes com EULA validada ou produção própria. Pinterest, redes sociais, downloads de YouTube e repositórios sem licença específica para os arquivos são proibidos. Candidatos nunca são aprovados automaticamente.

### FFmpeg

Instale `ffmpeg` e `ffprobe` no `PATH`, ou configure `FFMPEG_PATH` e `FFPROBE_PATH`. O pipeline remove áudio, limita o clip a 4–12 segundos, gera MP4/H.264 de até 720p/vertical equivalente e cria `poster.webp`.

```bash
# Descoberta legal, sem alterar banco
pnpm media:discover --dry-run
pnpm media:discover --dry-run --exercise leg-press --source wikimedia
pnpm media:discover --dry-run --output candidates.json
pnpm media:rediscover

# Persistir candidatos pending (requer secret server-side)
pnpm media:sync-candidates

# Validar o ambiente e processar somente itens revisados
pnpm media:ffmpeg-check
pnpm media:process-pending --approved-for-processing

# Baixar/processar candidatos selecionados
pnpm media:import --id UUID

# Cobertura, guard de produção e atribuições
pnpm media:report
pnpm media:production-report
pnpm media:validate
pnpm media:licenses
pnpm release:check
```

O downloader aceita somente HTTPS em `commons.wikimedia.org` e `upload.wikimedia.org`, valida redirects, MIME, timeout e o limite `MAX_SOURCE_MEDIA_MB`. Arquivos são deduplicados por SHA-256 e gravados em caminhos versionados pelo hash com cache imutável de um ano.

### Revisão

Abra `/admin/media-review`. A tela compara exercício e metadata lado a lado, permite corte, exige o checklist visual e separa as etapas `revisar → processar → publicar`. Apenas mídia processada com licença, hash, poster, revisor, papel e `execution_quality=approved` pode ser publicada. Uma demonstração principal exige os dez itens do checklist e existe no máximo uma por exercício.

O guia operacional completo está em `docs/MEDIA_OPERATIONS.md`.

Para o Vital Animations, guarde a EULA em `docs/licenses/` e use `media:local` somente depois de confirmar que a versão permite redistribuição no web app:

```bash
pnpm media:local --manifest pack.json --license-file EULA.txt --confirm-web-redistribution
```

O registro legal humano fica em `docs/EXERCISE_MEDIA_LICENSES.md`; o relatório gerado fica em `docs/generated-media-licenses.md`.

### Discovery v1.2

O discovery expandido parte dos aliases em português/inglês, gera até `MAX_QUERIES_PER_EXERCISE` queries distintas, explora categorias Wikimedia existentes e adiciona uma estratégia dedicada à coleção CDC. Chamadas usam concorrência limitada, retry/backoff e cache local de 24 horas em `.tmp/`.

O score é de correspondência de metadata, não de correção biomecânica. Equipamento ou subtipo divergente gera penalidades. Faixas: `strong >= 85`, `candidate >= 70`, `low confidence >= 55`; resultados abaixo disso permanecem fora da fila.

`media:report` mostra separadamente Approved Coverage e Candidate Coverage. Um candidato `pending` aumenta apenas a cobertura operacional; ele não ativa exercício nem o libera para o gerador. A arquitetura e os motivos de `missing` estão em `docs/MEDIA_DISCOVERY.md`.

## Limites clínicos

O produto organiza treinos; não diagnostica, não prescreve tratamento e não promete perda de peso. Contextos clínicos, inclusive gravidez, não alteram automaticamente o gerador na v1.
