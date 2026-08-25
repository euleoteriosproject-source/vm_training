# V20 Security Final

## Runtime e secrets

- `SUPABASE_SECRET_KEY_REQUIRED_IN_VERCEL = NO`.
- Features normais usam publishable key, sessão autenticada, RLS e RPCs.
- Mídia administrativa fica fora de banda; páginas/rotas operacionais ficam indisponíveis sem configuração privilegiada e não geram 500.
- A exclusão própria exige reautenticação e chama uma RPC `SECURITY INVOKER`; o helper privilegiado fica no schema `private`, valida `auth.uid()` e só apaga o usuário atual.
- `.env*`, `.tmp`, `.next`, `node_modules` e logs estão ignorados.
- Nenhum padrão de token/chave foi encontrado no conteúdo rastreado ou staged.
- Nenhum segredo foi incluído no browser bundle.

## Banco e ACL

- RLS/ACL/Auth Hook: PASS nos contratos locais.
- Bucket `exercise-media`: privado.
- Funções públicas privilegiadas inesperadas para `anon`/`authenticated`: 0.
- Clean reset: PASS.
- pgTAP: 145/145 PASS.
- Hosted migration history: alinhado após `20260825014657_v20_self_service_account_deletion.sql`.

## Integridade auditada

| Verificação | Resultado |
| --- | ---: |
| DB sem arquivo/poster | 0 |
| Arquivo sem DB | 0 |
| Hash divergente | 0 |
| GIF com um frame | 0 |
| PRIMARY estática | 0 |
| PRIMARY duplicada | 0 |
| Plano ativo sem PRIMARY | 0 |
| Erro de licença | 0 |

## Pendente após deployment

- Smoke HTTPS e runtime logs Vercel.
- Site URL e redirects finais do Supabase Auth.
- Isolamento cross-user e auditoria dos dois planos reais após onboarding humano.
