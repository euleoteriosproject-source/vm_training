# VM Training v1.7 — Implementation Report

Data de execução: 21/08/2026

Projeto Supabase: `inghftngeritrsezwxnm`

Branch: `main`

## Auth

- Confirm Email local: **OFF**.
- Confirm Email Hosted: **BLOCKED — ainda ON**. A alteração deve ser limitada ao campo de Auth pelo Dashboard/Management API; `supabase config push` não foi usado porque o arquivo local contém Site URL e redirects de desenvolvimento.
- Allowlist: **PASS**. Cadastro externo pela URL da LAN foi recusado pelo Auth com HTTP 403.
- Signup com sessão imediata: implementado no cliente quando o Hosted retornar `data.session`; validação real bloqueada enquanto Confirm Email estiver ON.
- Login público pela LAN: página e health check retornam HTTP 200, sem erro de console.
- Login autenticado pela LAN: bloqueado porque `.tmp/e2e.local.env` contém uma credencial antiga que o Hosted retorna como `invalid_credentials`; nenhum usuário foi criado ou senha redefinida para contornar o teste.
- Erros de credencial e erro interno agora são traduzidos para mensagens amigáveis em PT-BR.

## Onboarding e presets

- Três etapas.
- Checklist de equipamentos removido.
- Preferências por exercício removidas.
- Nascimento `DD/MM/AAAA` com validação de datas impossíveis e persistência ISO.
- Categorias: essencial (8 itens), padrão (18), completa (21), peso livre/funcional (7).
- Defaults e overrides explícitos coexistem por `user_equipment.source`.
- Peso inicial é persistido em `body_measurements` com origem `onboarding`.
- Regiões de atenção são opcionais e não representam diagnóstico.

## Treino e corpo

- Usuário real preservado: **YES**.
- Plano existente preservado: **YES**.
- Plano Production: `active`, 3 dias, 18 exercícios.
- Exercícios ativos no catálogo: 35.
- Dependência de mídia removida da prontidão, ativação e geração.
- Drafts permanecem visíveis para consulta e mensagens antigas de bloqueio por vídeo foram removidas.
- Snapshot corporal adicionado a Hoje e Progresso, com peso, altura, IMC, tendência e última medição.
- Substituição imediata, “Minha academia não tem”, “Indisponível hoje”, “Ver outra opção” e desfazer implementados por RPC transacional.

## Mídia

- Processados revisados: 7.
- Aprovados PRIMARY: 6.
- Mantido `processed`: 1 (bike).
- Hash remoto, fonte e licença: **PASS** para 7/7.
- Revisão e aprovação vinculadas ao admin real: **PASS** para os 6 publicados.

## Segurança

- Migrations v1.7 aplicadas e alinhadas no Hosted.
- `supabase db lint --linked --level error`: sem erros de schema.
- RLS: todas as tabelas de domínio protegidas.
- `anon`: zero grants em tabelas de domínio.
- Auth hook: preservado.
- Storage: bucket privado.
- Security Advisor: 3 warnings — dois RPCs `SECURITY DEFINER` intencionais, protegidos por `auth.uid()`/ownership, e leaked-password protection desligada. Não foi contratado recurso pago nem alterada configuração fora do escopo.

## Verificação

- Unit: **PASS**, 52 testes em 15 arquivos.
- Lint: **PASS**, zero warnings.
- Typecheck: **PASS**.
- Build Next.js 16.3.1: **PASS**, 23 páginas geradas; o prebuild apenas reportou, como esperado, exercícios ativos sem mídia opcional.
- pgTAP ACL: **PASS**, 30 checks do contrato canônico v1.7.
- LAN: `http://192.168.2.109:3000`, servidor em `0.0.0.0:3000`.
- Viewports públicos 375×812, 390×844 e desktop: sem overflow horizontal.
- E2E autenticado completo: **BLOCKED** por ausência de uma credencial Hosted válida no ambiente local.

## Gate

`BLOCKED`

Pendências externas: desligar Confirm Email no Hosted e repetir login/E2E móvel com a credencial do usuário real. Os recursos implementados, as migrations e a publicação de mídia estão concluídos sem substituir o usuário ou o plano atuais.
