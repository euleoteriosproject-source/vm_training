# VM Training v2.0 — Final Production SDD

Data da execução: 24/08/2026

Supabase Production: `inghftngeritrsezwxnm`

Branch de release: `main`

## Decisões arquiteturais

- `exercises.active` continua independente de mídia.
- Geração automática usa somente exercícios ativos com uma `PRIMARY_DEMO` aprovada, animada e com execução aprovada.
- Ativação de plano e início de treino falham fechados se faltar mídia primária.
- Uma sessão `in_progress` existente é retomada em vez de duplicada.
- Substituições em sessão ativa exigem alternativa media-ready.
- Storage permanece privado, com caminhos imutáveis derivados do SHA-256.
- Publicação automatizada registra agente/versão e não fabrica revisão humana.
- A reconciliação do plano é service-only e transacional, sem ampliar grants de tabelas pessoais.

## Escopo concluído

- Três mídias finais validadas e publicadas: `lat-pulldown`, `farmer-walk` e `plank`.
- Plano ativo reconciliado de 7/18 para 10/10 exercícios únicos com mídia.
- Gerador corrigido para nunca criar plano automático sem cobertura visual integral.
- Índices das cinco FKs reportadas pelo advisor adicionados.
- Integridade de Storage e hash verificada para todas as dez primárias do plano.
- Matriz Playwright inclui Chromium, WebKit e 375×812, 390×844, 430×932 e 1440×900.
- Clean reset completo passou com todas as migrations e o seed; pgTAP local passou 137/137.

## Gates que permanecem humanos/externos

- Cadastro e onboarding da segunda pessoa real allowlisted.
- Login manual do admin no HTTPS final.
- UAT real em iPhone, com senha digitada apenas pela pessoa.
- Autorização específica para provisionar `SUPABASE_SECRET_KEY` como secret server-only na Vercel.

O gate final continua binário: somente `V20_PRODUCTION_READY` quando todos os itens acima forem comprovados; até lá, `BLOCKED`.
