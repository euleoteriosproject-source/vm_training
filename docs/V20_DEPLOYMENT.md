# V20 Deployment

## Destinos

- Supabase Production: `inghftngeritrsezwxnm`.
- Vercel team: `Vinicius Euleoterio's projects`.
- Vercel plan: Hobby.
- Projeto: `vm-training`.
- Repositório: `euleoteriosproject-source/vm_training`.
- Branch: `main`.
- Custo adicional: R$ 0.

## Environment Production mínimo

Somente valores browser-safe são necessários:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Não provisionar no deployment web:

- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- senhas E2E
- tokens operacionais

`NEXT_PUBLIC_APP_URL` e `PRODUCTION_URL` pertencem aos checks pós-deploy, não ao runtime normal.

## Estado validado

- Commit de aplicação: `f18fc8c` em `origin/main`.
- Build local: PASS.
- Supabase Hosted: sem migration pendente.
- Deploy via conexão Vercel: bloqueado por HTTP 403 de permissão para Preview e Production.
- Vercel CLI: login por dispositivo necessário antes de criar o projeto.
- Production URL, health remoto e Auth redirects: pendentes da autorização.

## Desenvolvimento/LAN

O app já foi validado em `0.0.0.0:3000`. O endereço LAN observado foi `http://192.168.2.109:3000`; ele não é Production e pode mudar por DHCP.
