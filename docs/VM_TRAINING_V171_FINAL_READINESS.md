# VM Training v1.7.1 Final Production Readiness

Data da validação: 2026-08-22

Projeto Production: `inghftngeritrsezwxnm`

Branch: `main`

## Auth

| Controle                              | Resultado                                                  |
| ------------------------------------- | ---------------------------------------------------------- |
| Confirm Email                         | OFF (`mailer_autoconfirm=true`)                            |
| Signup permitido                      | Sessão imediata validada no Supabase local                 |
| Allowlist                             | PASS — 2 entradas ativas em Production                     |
| Before User Created Hook              | PASS                                                       |
| `handle_new_user` / trigger de perfil | PASS                                                       |
| Admin existente                       | PASS — 1 usuário confirmado, 1 perfil admin, sem recriação |
| Senha mínima                          | 12                                                         |
| Caracteres requeridos                 | minúscula, maiúscula e número                              |
| Leaked Password Protection            | OFF — `KNOWN_FREE_TIER_LIMITATION`                         |
| Upgrade pago                          | NÃO                                                        |

O patch do Management API alterou somente `mailer_autoconfirm`,
`password_min_length` e `password_required_characters`. SMTP, OAuth, Auth Hook,
URLs, allowlist e usuários não foram alterados. A proteção contra senhas
vazadas permanece não remediada porque requer plano Supabase pago.

## Security Warnings

| Advisor                                              | Antes |                          Depois |
| ---------------------------------------------------- | ----: | ------------------------------: |
| Total                                                |     3 |                               1 |
| `authenticated_security_definer_function_executable` |     2 |                               0 |
| `auth_leaked_password_protection`                    |     1 | 1 — limitação conhecida do Free |
| Avisos inesperados                                   |     0 |                               0 |

## RPC Hardening

Migration: `20260822134023_security_harden_substitution_rpc_v171.sql`

| RPC                           | API pública                                                        | Implementação interna                           |
| ----------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| `substitute_workout_exercise` | `public`, `SECURITY INVOKER`, EXECUTE somente para `authenticated` | `private`, `SECURITY DEFINER`, `search_path=''` |
| `undo_workout_substitution`   | `public`, `SECURITY INVOKER`, EXECUTE somente para `authenticated` | `private`, `SECURITY DEFINER`, `search_path=''` |

- Funções privadas não estão no schema exposto pelo Data API.
- `anon` não tem uso do schema privado nem execução das RPCs públicas.
- As implementações validam `auth.uid()`, propriedade, sessão em andamento,
  motivos, equipamento e lista de exclusão.
- Ataques A → B para sessão, undo, equipamento e evento: PASS local.
- Falha forçada durante restauração prova rollback integral: PASS.
- Grants canônicos de tabelas públicas: 99, sem ampliação.
- Tabelas públicas sem RLS: 0.

## Production Snapshot

Os valores abaixo eram iguais antes e depois da migration:

| Métrica                       |                  Valor |
| ----------------------------- | ---------------------: |
| Planos ativos                 |                      1 |
| Dias do plano ativo           |                      3 |
| Exercícios do plano ativo     |                     18 |
| PRIMARY aprovadas             |                      6 |
| Mídias processadas            | 1 (`bike`, preservada) |
| Objetos no Storage            |                     14 |
| Perfis                        |                      1 |
| Escritas inesperadas de mídia |                      0 |

## Mobile Acceptance

| Fluxo real em Production       | Estado        |
| ------------------------------ | ------------- |
| Login com a conta real         | PENDING HUMAN |
| Dashboard                      | PENDING HUMAN |
| Body Snapshot / IMC / data     | PENDING HUMAN |
| Day 1, Day 2 e Day 3           | PENDING HUMAN |
| Cards, GIF e fallback sem GIF  | PENDING HUMAN |
| Substituição e undo sem reload | PENDING HUMAN |
| Tema claro/escuro              | PENDING HUMAN |

A senha real não foi solicitada, lida, registrada ou adicionada a fixture. O
usuário deve digitá-la diretamente no navegador do celular conectado à mesma
rede local.

## Quality

| Gate                               | Resultado                                                        |
| ---------------------------------- | ---------------------------------------------------------------- |
| `supabase db reset`                | PASS — 22 migrations + seed                                      |
| pgTAP / RLS / ACL / ataques        | PASS — 6 arquivos, 100 testes                                    |
| `supabase db lint --level warning` | PASS — 0 erros                                                   |
| `pnpm lint`                        | PASS                                                             |
| `pnpm typecheck`                   | PASS                                                             |
| `pnpm test`                        | PASS — 15 arquivos, 53 testes                                    |
| `pnpm test:e2e`                    | PASS — 12, SKIP — 2 de mídia sem fixture                         |
| `pnpm build`                       | PASS                                                             |

Os gates de código foram repetidos após a consolidação final deste documento.

## Cost

Custo adicional: **R$ 0**. Nenhum projeto, branch, add-on, SMTP pago ou upgrade
foi criado ou habilitado.

## Git

O SHA definitivo e o resultado do push são registrados no handoff que acompanha
este documento. Arquivos temporários e credenciais permanecem ignorados.

## Final Gate

`BLOCKED — PENDING REAL MOBILE HUMAN ACCEPTANCE`

Todos os gates automatizáveis e sem custo estão aprovados. A declaração
`V17_READY_FOR_REAL_USE` depende exclusivamente da aceitação manual descrita
acima.
