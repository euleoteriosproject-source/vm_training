# VM Training v2.0 — Final Deployment

## Secret Audit

- `SUPABASE_SECRET_KEY` runtime required: **NO**.
- Fluxos normais usam sessão autenticada, RLS e RPCs.
- Exclusão de conta usa RPC limitada ao próprio `auth.uid()`.
- Administração/publicação de mídia permanece operacional e fora do deployment web.
- Secret no browser: **NO**.
- Secret no Git: **NO**.

## Vercel

- Projeto: `vm-training`.
- Plano: Hobby.
- Repositório: `euleoteriosproject-source/vm_training`.
- Branch de Production: `main`.
- Production URL: `https://vm-training.vercel.app`.
- HTTPS: **PASS**.
- Build remoto Next.js: **PASS**.
- Health remoto: **PASS** (`/api/health` retornou HTTP 200).
- Login e cadastro: **PASS** em desktop/mobile, sem erro de console.
- Logs iniciais: critical/fatal/HTTP 500 = **0**.

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
- Site URL: `https://vm-training.vercel.app`.
- Redirects exatos de callback e recuperação de senha: **PASS**.
- Confirmação de e-mail: **OFF**.
- Senha mínima 12, complexidade e TOTP: **preservados**.
- Plano admin Hosted: 10/10 exercícios únicos com PRIMARY válida.
- `ACTIVE_PLAN_WITHOUT_PRIMARY`: 0 no estado auditado antes do onboarding da segunda pessoa.

## Gates humanos pendentes

1. Onboarding pessoal da segunda pessoa real.
2. Auditoria read-only do segundo usuário e da cobertura PRIMARY do plano.
3. UAT do admin em iPhone real.
4. UAT do membro e auditoria final dos dois planos/logs.

## Gate

`BLOCKED`

Deployment, HTTPS, Auth URLs e automação estão prontos. O gate não pode virar `V20_PRODUCTION_READY` antes das validações humanas acima.
