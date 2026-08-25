# V20 Deployment

## Destinos

- Supabase Production: `inghftngeritrsezwxnm`.
- Vercel team: `Vinicius Euleoterio's projects`.
- Vercel plan: Hobby.
- Projeto: `vm-training`.
- Repositório: `euleoteriosproject-source/vm_training`.
- Branch: `main`.
- Production URL: `https://vm-training.vercel.app`.
- Custo adicional: R$ 0.

## Environment Production mínimo

Configuradas somente as variáveis browser-safe:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Não provisionadas no deployment web:

- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- senhas E2E
- tokens operacionais

`NEXT_PUBLIC_APP_URL` e `PRODUCTION_URL` não são requisitos do runtime normal.

## Estado validado

- Baseline implantada: commit `9fac933a2dd8ca51989264fde73448c0b01fdb6d` de `main`.
- Projeto Vercel vinculado ao GitHub; Production branch: `main`.
- Framework Next.js detectado automaticamente no build.
- Build remoto: **PASS**.
- Deployment: **READY** e promovido ao alias estável.
- HTTPS: **PASS**.
- `/api/health`, `/login` e `/sign-up`: HTTP 200.
- Supabase Hosted: sem migration pendente.
- Supabase Auth Site URL e redirects de produção: **PASS**.
- `.vercelignore` limita o upload aos fontes versionáveis; `.env.local`, `.tmp`, `node_modules` e artefatos locais não são enviados.

## Desenvolvimento/LAN

O app também foi validado em `0.0.0.0:3000`. O endereço LAN observado foi `http://192.168.2.109:3000`; ele não é Production e pode mudar por DHCP.
