# VM Training v1.7 — Product Simplification

## Objetivo

Reduzir o tempo entre cadastro e primeiro treino, preservar o usuário e o plano existentes e remover qualquer dependência funcional entre catálogo/treino e mídia aprovada. O produto continua privado por allowlist e usa somente os recursos já existentes no projeto Supabase `inghftngeritrsezwxnm`.

## Decisões de produto

- Cadastro permitido somente a e-mails presentes em `allowed_signup_emails` pelo hook `before_user_created`.
- Confirmação de e-mail desativada no ambiente local. No Hosted, a alteração é um gate operacional independente e não deve ser feita empurrando URLs locais pelo `config.toml`.
- Onboarding em três etapas: dados corporais; objetivo/rotina; categoria da academia e regiões opcionais de atenção.
- Data de nascimento exibida e validada como `DD/MM/AAAA`, persistida como ISO `YYYY-MM-DD`.
- Um objetivo principal. Preferências técnicas, variedade e cardio usam defaults compatíveis com o schema legado.
- Quatro presets: academia essencial, padrão, completa e peso livre/funcional.
- Overrides explícitos do usuário prevalecem sobre o preset. “Minha academia não tem” registra indisponibilidade permanente e procura substituto imediatamente.
- Peso informado no onboarding cria ou atualiza um único registro corporal de origem `onboarding`.
- Dashboard e Progresso exibem peso, altura, IMC, tendência e data da última medição. IMC é tratado como indicador de triagem; menores de 20 anos não recebem classificação adulta.
- Planos estruturalmente válidos são ativados sem exigir mídia. Exercícios estruturalmente válidos podem permanecer ativos sem GIF.
- Mídia continua sendo um incremento opcional: GIF aprovado quando existe; poster/texto como fallback quando não existe.

## Modelo de dados

A migration v1.7 adiciona:

- `training_preferences.gym_category` e `equipment_preset_version`;
- `user_equipment.source` (`preset` ou `user_override`);
- `body_measurements.source` (`manual` ou `onboarding`);
- `gym_equipment_presets`;
- `user_movement_attention`;
- `workout_substitution_events`.

As funções `complete_onboarding`, `get_plan_readiness`, `substitute_workout_exercise` e `undo_workout_substitution` concentram as transações. Os RPCs de substituição validam `auth.uid()`, dono da sessão e sessão em andamento. Grants e RLS seguem least privilege; `anon` não recebe acesso a tabelas de domínio.

## Critérios de aceite

- Fluxo principal sem checklist manual de equipamentos ou exercícios.
- Plano anterior e usuário real preservados.
- Plano atual com 3 dias e 18 exercícios continua utilizável.
- Ausência de mídia não bloqueia plano, catálogo ou sessão.
- Substituição e desfazer são atômicos e auditáveis.
- Interfaces de 375×812, 390×844 e desktop não têm overflow horizontal.
- `lint`, `typecheck`, testes unitários e `build` passam.
- Migrações locais e remotas permanecem alinhadas.
- Os sete GIFs processados recebem decisão final reproduzível e seis aprovados são publicados pela função server-only.

## Gates externos

O release só pode ser declarado pronto para uso real quando:

1. **Confirm Email** estiver desligado no Supabase Hosted;
2. um login móvel for repetido com a credencial válida do usuário real;
3. os avisos restantes do Security Advisor forem resolvidos ou aceitos formalmente.

Não criar usuário substituto, redefinir senha, abrir cadastro público, criar projeto/branch ou contratar recurso pago para contornar um gate.
