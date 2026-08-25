# VM Training v2.0 — Final Deployment

## Secret Audit

- `SUPABASE_SECRET_KEY` runtime required: **NO**.
- Fluxos normais usam sessão autenticada, RLS e RPCs.
- Exclusão de conta usa RPC limitada ao próprio `auth.uid()`.
- Administração/publicação de mídia permanece operacional e fora do deployment web.
- Secret no browser: **NO**.
- Secret no Git: **NO**.

## Vercel

- Projeto pretendido: `vm-training`.
- Plano: Hobby.
- Production URL: pendente.
- Build local sem requisito de secret: **PASS**.
- A conexão Vercel disponível retorna HTTP 403 para criar Preview ou Production; a CLI aguarda autorização direta do proprietário.

## Automated E2E

- Total: **33/33 PASS**.
- Mobile Chromium: **11/11 PASS**.
- WebKit/iPhone 13: **11/11 PASS**.
- Desktop Chromium: **11/11 PASS**.
- Skipped por senha real: **0**.
- Contas, senhas, plano e mídia são fixtures descartáveis do Supabase local.

## Supabase

- Project ref validado: `inghftngeritrsezwxnm`.
- Migration de exclusão própria aplicada; dry-run posterior: **up to date**.
- Clean reset: **PASS**.
- pgTAP: **145/145 PASS**.
- Plano admin Hosted: 10/10 exercícios únicos com PRIMARY válida.
- `ACTIVE_PLAN_WITHOUT_PRIMARY`: 0 no estado auditado antes do onboarding da segunda pessoa.

## Gates humanos pendentes

1. Deployment HTTPS e configuração final das URLs de Auth.
2. Onboarding pessoal da segunda pessoa real.
3. UAT do admin em iPhone real.
4. UAT do membro e auditoria final dos dois planos/logs.

## Gate

`BLOCKED`

O código, banco e automação estão prontos. O gate não pode virar `V20_PRODUCTION_READY` antes da autorização Vercel e das validações humanas acima.
