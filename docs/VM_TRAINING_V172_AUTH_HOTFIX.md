# VM Training v1.7.2 Auth Hotfix

Data da validação: 2026-08-22

Projeto Production: `inghftngeritrsezwxnm`

App LAN: `http://192.168.2.109:3000`

Branch: `main`

## Incident Reproduction

| Superfície            | Antes                                       | Depois                        |
| --------------------- | ------------------------------------------- | ----------------------------- |
| Desktop / localhost   | FAIL                                        | PASS                          |
| Mobile viewport / LAN | FAIL                                        | PASS                          |
| Mensagem observada    | `Internal Server Error` / genérica de login | `E-mail ou senha incorretos.` |

Antes do hotfix, login e cadastro submetiam para a rota intermediária
`/supabase/auth/v1/*` do próprio Next. O processo que ocupava a porta 3000
respondia HTTP 500 e a chamada não chegava ao Supabase Hosted.

## Hosted Evidence Before Fix

| Evidência                                     | Resultado                                     |
| --------------------------------------------- | --------------------------------------------- |
| Tentativa humana de login chegou ao Hosted    | NÃO                                           |
| Tentativa humana de cadastro chegou ao Hosted | NÃO                                           |
| Último evento correspondente no Hosted        | Nenhum POST atual; apenas reload/configuração |

Writes durante o diagnóstico: Auth `0`, Database `0`, Storage `0`, Media `0` e
Workout `0`.

## Root Cause

- Arquivo: `lib/supabase/client.ts`
- Função: `createClient()`
- Linha lógica que falhava: criação do browser client com
  `` `${window.location.origin}/supabase` ``.
- Dependência adicional: rewrite de `/supabase/:path*` em `next.config.ts`.
- Limite da falha: `POST /supabase/auth/v1/token` retornava HTTP 500 no processo
  Next da porta 3000, antes de qualquer request Hosted.

O formulário é um Client Component; não havia Server Action nem `redirect()`
capturado por `try/catch`. `createClient()` e `signInWithPassword()` eram
alcançados, mas login e signup compartilhavam o mesmo proxy intermediário e
falhavam no transporte. O mapper antigo ainda convertia o erro de signup em uma
mensagem genérica específica de login.

## Fix

- O browser Supabase client usa diretamente a URL pública configurada do Hosted.
- O rewrite `/supabase/*` e sua exceção no matcher do proxy foram removidos.
- O submit é um handler cliente explícito e verifica sessão antes do redirect.
- Login e signup têm tracing sanitizado com correlation ID, sem e-mail, senha,
  token ou chave.
- Erros esperados possuem classificação e mensagens específicas.
- Erros inesperados/rede podem ser enviados a um endpoint same-origin que aceita
  e registra somente um envelope estritamente sanitizado.
- Fixtures descartáveis de signup existem somente no seed Supabase local.

O SSR existente já usa o contrato atual de `cookies()`, `getAll()` e `setAll()`;
nenhuma service-role key é enviada ao browser.

## Runtime Config

| Controle                                 | Resultado                               |
| ---------------------------------------- | --------------------------------------- |
| Production Supabase URL                  | PASS — ref exata `inghftngeritrsezwxnm` |
| Browser publishable key                  | PRESENT                                 |
| Wrong/local Supabase env no build Hosted | NONE                                    |
| Hosted Auth settings connectivity        | PASS                                    |
| Confirm Email                            | OFF (`mailer_autoconfirm=true`)         |
| Allowlist / Before User Created Hook     | PRESERVADOS                             |

## Login

| Controle                      | Resultado                                         |
| ----------------------------- | ------------------------------------------------- |
| Auth API invocation localhost | PASS — Hosted `/auth/v1/token`                    |
| Auth API invocation LAN       | PASS — Hosted `/auth/v1/token`                    |
| Auth API invocation WebKit    | PASS — motor Safari em viewport mobile pela LAN   |
| Correlação em Hosted Auth log | PASS — `POST /token`, password, HTTP 400 esperado |
| Sessão/cookie                 | PASS em fixture local                             |
| Redirect autenticado          | PASS                                              |
| Invalid credentials mapping   | PASS                                              |

As chamadas Hosted usaram credenciais fictícias e retornaram
`invalid_credentials`; a senha real não foi lida nem automatizada.

## Signup

| Cenário no Supabase local             | Resultado              |
| ------------------------------------- | ---------------------- |
| Allowlisted + sessão imediata         | PASS                   |
| Bloqueado pela allowlist              | PASS                   |
| Já cadastrado                         | PASS                   |
| Senha fraca                           | PASS, sem request Auth |
| Mensagem genérica específica de login | AUSENTE                |

Nenhum signup foi realizado em Production.

## Tests

| Gate             | Resultado                                |
| ---------------- | ---------------------------------------- |
| `pnpm lint`      | PASS                                     |
| `pnpm typecheck` | PASS                                     |
| `pnpm test`      | PASS — 19 arquivos, 66 testes            |
| `pnpm test:e2e`  | PASS — 16; SKIP — 2 de mídia sem fixture |
| WebKit LAN smoke | PASS — Hosted Auth e mensagem correta    |
| `pnpm build`     | PASS                                     |
| Secrets scan     | PASS — zero achados de alto risco        |

## Production Preservation

As contagens foram conferidas antes e depois da validação Hosted:

| Métrica                     | Antes | Depois |
| --------------------------- | ----: | -----: |
| Auth users                  |     1 |      1 |
| Profiles                    |     1 |      1 |
| Planos ativos               |     1 |      1 |
| Dias do plano ativo         |     3 |      3 |
| Exercícios do plano ativo   |    18 |     18 |
| Exercícios ativos           |    35 |     35 |
| PRIMARY aprovadas           |     6 |      6 |
| Mídia `bike` processada     |     1 |      1 |
| Objetos em `exercise-media` |    14 |     14 |

Database repair `0`, workout changes `0`, media changes `0`, Storage changes
`0` e usuários Production inesperadamente criados `0`.

## Git

Commit e push são registrados no handoff final. `.env.local`, credenciais E2E e
artefatos `.tmp` permanecem ignorados.

## Gate

`READY_FOR_REAL_AUTH_RETEST`

Próxima ação humana: testar o login da conta admin existente diretamente no
navegador LAN, sem compartilhar a senha, e então correlacionar o resultado com o
Hosted Auth log.
