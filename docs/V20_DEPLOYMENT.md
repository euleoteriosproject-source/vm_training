# V20 Deployment

## Destinos

- Supabase Production: `inghftngeritrsezwxnm` (`sa-east-1`).
- Vercel team: `Vinicius Euleoterio's projects`.
- Plano Vercel: Hobby.
- Projeto pretendido: `vm-training`.
- Branch: `main`.
- Custo adicional permitido/realizado: R$ 0.

## Variáveis necessárias

Browser-safe:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only:

- `SUPABASE_SECRET_KEY`
- `SUPABASE_AUTH_HOOK_VERIFIED=true`

`SUPABASE_INTERNAL_URL` é opcional no runtime Vercel porque o cliente servidor faz fallback para a Hosted URL pública. `NEXT_PUBLIC_APP_URL` e `PRODUCTION_URL` pertencem aos scripts de release/smoke após existir uma URL final.

## Estado

- Build local Production: PASS.
- Projeto Vercel: ainda não criado.
- Production URL: pendente.
- Supabase Site URL/redirects: pendentes da URL final.
- Motivo: a proteção de egress exige autorização específica antes de enviar `SUPABASE_SECRET_KEY` ao ambiente criptografado server-only da Vercel.

## Desenvolvimento/LAN

O servidor foi validado em `0.0.0.0:3000`. Na rede local atual, o endereço de teste é `http://192.168.2.109:3000`. Esse endereço não é Production e pode mudar com DHCP.
