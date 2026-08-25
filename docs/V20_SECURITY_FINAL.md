# V20 Security Final

## Resultado técnico

- RLS habilitado nas 25 tabelas públicas.
- ACL canônica de menor privilégio preservada; `service_role` não recebeu acesso às tabelas pessoais.
- As RPCs v2.0 de reconciliação são `SECURITY DEFINER`, verificam `auth.role()='service_role'`, possuem `search_path=''` e têm EXECUTE apenas para `service_role`/owner.
- Funções públicas privilegiadas não são executáveis por `anon` ou `authenticated`.
- Auth Hook continua restrito a `supabase_auth_admin`.
- Bucket `exercise-media` privado.
- DB lint: zero erros.
- Security Advisor: somente o aviso conhecido de leaked-password protection do plano Free.
- `pnpm audit --prod --audit-level high`: zero vulnerabilidades conhecidas.
- Clean reset e seed: PASS.
- pgTAP local: 137/137 PASS, cobrindo RLS, ACL, Auth Hook, conclusão, substituição e gates de mídia v2.0.

## Integridade

| Verificação              | Resultado |
| ------------------------ | --------: |
| DB sem arquivo/poster    |         0 |
| Arquivo sem DB           |         0 |
| Hash divergente          |         0 |
| GIF com um frame         |         0 |
| PRIMARY estática         |         0 |
| PRIMARY duplicada        |         0 |
| Plano ativo sem PRIMARY  |         0 |
| Auth e-mail duplicado    |         0 |
| Profile e-mail duplicado |         0 |
| Plano ativo duplicado    |         0 |
| Sessão ativa duplicada   |         0 |
| Workout day órfão        |         0 |

## Secrets

- `.env`, `.env.local`, `.env.production`, `.env.*.local`, `.env*`, `.tmp`, `.next`, `node_modules` e logs estão ignorados.
- O deploy deve provisionar `SUPABASE_SECRET_KEY` apenas como secret server-only; nunca `NEXT_PUBLIC_*`.
- Nenhuma senha real deve ser armazenada em E2E, Git, docs ou logs.

## Pendência externa

O secret scan final e o commit/push são executados no fechamento. O envio da secret key à Vercel requer autorização específica do proprietário e permanece bloqueado até essa confirmação.
