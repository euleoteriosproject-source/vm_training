# VM Training v2.1 — Final Technical Report

## Production data

- Supabase project: `inghftngeritrsezwxnm`.
- Auth users/profiles/onboarded: 1/1/1, preservados.
- Active/media-ready/eligible: 60/36/30.
- Media integrity: todos os contadores bloqueantes em zero.
- Admin plan: 3 dias, 18 slots, 14 únicos, 77,8% de unicidade, overlaps
  0/33,3/33,3%, 9 padrões, mídia 100%, inválidos 0, inelegíveis 0.
- Sessões em andamento preservadas: 1.

## Automated gates

- Lint: PASS.
- Typecheck: PASS.
- Unit: 79/79 PASS.
- pgTAP: 169/169 PASS.
- E2E: 36/36 PASS.
- Build: PASS.
- Dependency audit: nenhuma vulnerabilidade high/critical conhecida.
- Secret scan: 0 achados em artefatos de release.

## Production verification

- Baseline v2.1: `f8d8b619145103b21b6eb93aee59c2cd304ac1ed`.
- Production smoke hardening: `7d963c7`.
- Vercel deployment: READY, publicado no alias canônico
  `https://vm-training.vercel.app`.
- HTTP smoke: `/`, `/login`, `/sign-up` e `/api/health` PASS.
- Browser smoke: login e cadastro hidratados em Production, console sem erros.
- Mobile smoke: viewport 390x844 sem overflow horizontal.
- Vercel runtime error logs após o deploy: 0 ocorrências.
- Supabase CLI não expõe consulta ao Hosted Logs Explorer. As operações de
  migration, Auth, Database e Storage e as reconciliações finais terminaram sem
  erro inesperado; não foi inventado um PASS de inspeção direta de logs.

## Release gate

O código, banco, mídia, plano, deploy e smoke público estão tecnicamente prontos.
Os únicos gates não automatizáveis permanecem registrados em `V21_UAT.md`: UAT
pessoal do admin e signup/onboarding da segunda pessoa real. Nenhum deles foi
simulado.

Decisão final: `BLOCKED — ACTION_REQUIRED_ADMIN_UAT + ACTION_REQUIRED_SECOND_USER`.
