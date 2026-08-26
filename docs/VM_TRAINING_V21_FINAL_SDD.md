# VM Training v2.1 — Final SDD Implementado

## Arquitetura entregue

- Catálogo e mídia continuam separados de elegibilidade individual.
- `exercise_media_readiness` centraliza PRIMARY/licença/proveniência/hash/files.
- `get_auto_plan_catalog()` centraliza elegibilidade e motivos por usuário.
- Gerador determinístico `v2.1.0` calcula qualidade e usa histórico recente.
- `create_and_activate_plan_v21()` valida e versiona planos atomicamente.
- Substituições exigem mídia pronta, equipamento e compatibilidade de movimento.
- `/exercises` oferece biblioteca autenticada com busca, filtros, mídia assinada
  e detalhes sem sobrecarregar a tela de treino.
- Pipeline versionado promove mídia licenciada com identidade automatizada
  explícita e bucket privado.

## Migrations

1. `20260825030000_v21_readiness_and_plan_quality.sql`
2. `20260825190247_v21_exercise_library_expansion.sql`
3. `20260825194354_v21_media_ready_substitutions.sql`
4. `20260825203826_v21_automated_media_publish_rpc.sql`

Todas foram reaplicadas em banco local limpo, cobertas por pgTAP, revisadas em
dry-run Hosted, aplicadas sem seed/reset e reconciliadas como `up to date`.

## Não regressão

Auth v2.0.1, usuários/perfis reais, allowlist, Auth Hook, RLS/ACL, Storage
privado, mídia anterior, histórico, body measurements, preferências, sessões,
substituições e plano antigo arquivado foram preservados. Custo adicional:
**R$ 0**.

## Stop condition

O desenvolvimento técnico v2.1 encerra após deploy e smoke Production. Gates
que exigem ação pessoal permanecem documentados em `V21_UAT.md` e não podem ser
simulados.
