# VM Training v2.1 — Security

## Estado final

- Auth continua `browser → same-origin Next.js → Supabase Hosted`; chamadas
  diretas do browser a `/auth/v1/*` não foram reintroduzidas.
- Login/signup usam somente URL Hosted e chave publishable no runtime web.
- `SUPABASE_SECRET_KEY` e `service_role` não são necessários no Vercel/browser.
- `exercise-media` permanece privado; entrega usa URL assinada autenticada.
- RLS, ACL, Auth Hook, isolamento por usuário e políticas de Storage foram
  preservados.
- Publicação automatizada v2.1 é uma RPC exclusiva de `service_role` e registra
  método/agente/versão; não atribui `reviewed_by` humano.
- Elegibilidade, substituição e ativação são validadas novamente no banco.
- Novas views usam `security_invoker`; funções `security definer` usam
  `search_path = ''` e grants explícitos.

## Evidências

- pgTAP/RLS/ACL/Storage/Auth Hook: **169/169 PASS**.
- E2E same-origin em mobile Chromium, WebKit e desktop: **36/36 PASS**.
- Dependency audit de produção: **0 high/critical conhecidos**.
- Scan de candidatos ao Git: **0 secrets**.
- Production HTTP/browser smoke: **PASS**.
- Vercel runtime error logs após o deploy: **0 ocorrências**.
- `.env*`, `.tmp/`, `.next/`, `node_modules/` e logs permanecem ignorados.
- Project ref antes de writes: `inghftngeritrsezwxnm` (**MATCH**).
- Migration dry-run: exatamente quatro migrations v2.1; pós-apply: **up to
  date**.
- BOM/controles inválidos continuam cobertos pela validação de configuração.

Os dois literals encontrados pelo scanner amplo estão em teste unitário de
autenticação e são fixtures sintéticas; nenhum valor real foi versionado.

A CLI instalada não oferece leitura do Hosted Logs Explorer do Supabase. A
ausência de acesso direto foi registrada explicitamente; os resultados das
operações e reconciliações de Auth, Database e Storage não apresentaram erro
inesperado.
