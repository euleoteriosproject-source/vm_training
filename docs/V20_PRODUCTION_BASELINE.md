# V20 Production Baseline

Auditoria read-only executada em 24/08/2026 diretamente no projeto Hosted `inghftngeritrsezwxnm`.

## Contagens

| Entidade                            | Total |
| ----------------------------------- | ----: |
| `auth.users`                        |     1 |
| Profiles                            |     1 |
| Admins                              |     1 |
| E-mails allowlisted ativos          |     2 |
| Allowlisted sem profile             |     1 |
| Planos ativos                       |     1 |
| Dias no plano ativo                 |     3 |
| Exercícios únicos no plano ativo    |    10 |
| Exercícios no catálogo              |    35 |
| Registros de mídia                  |    44 |
| PRIMARY aprovadas                   |    10 |
| Objetos no bucket privado           |    22 |
| Medições corporais                  |     1 |
| Preferências de treino              |     1 |
| Metas ativas                        |     7 |
| Equipamentos disponíveis do usuário |    17 |
| Sessões                             |     2 |
| Sessões em andamento                |     1 |
| Set logs                            |    36 |
| Eventos de substituição             |     0 |

## Estado funcional

- Admin existente preservado, com onboarding completo.
- Segundo e-mail real está allowlisted, porém ainda não criou conta/profile.
- Plano ativo: 3 dias, 10 exercícios únicos, cobertura PRIMARY 100%.
- Uma sessão em andamento foi preservada durante a reconciliação.
- Uma conclusão histórica em 0% permanece intacta e classificada como legado a auditar; não houve nova conclusão 0% após o gate v2.0.

## Infraestrutura e segurança

- Projeto Supabase: `ACTIVE_HEALTHY`, região `sa-east-1`, PostgreSQL 17.6.
- Migrations locais/Hosted alinhadas, incluindo a compatibilidade local `20260824235600` e as migrations funcionais até `20260825000200`.
- Todas as 25 tabelas públicas estão com RLS habilitado.
- Bucket `exercise-media` permanece privado.
- Schema lint: zero erros.
- Security Advisor: somente `Leaked Password Protection Disabled`, aceito porque o upgrade é pago e proibido pelo SDD.
- Performance Advisor: apenas índices ainda não utilizados, nível informativo; nenhuma FK sem índice permaneceu.
