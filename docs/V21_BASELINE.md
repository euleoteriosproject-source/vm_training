# VM Training v2.1 — Baseline de Production

Auditoria executada em `2026-08-25T17:05:37.120Z` contra o projeto Supabase
`inghftngeritrsezwxnm`, exclusivamente em modo de leitura.

## Garantias da captura

- Nenhuma migration foi aplicada.
- Nenhum arquivo foi enviado, alterado ou removido do Storage.
- Nenhum plano, usuário, perfil ou registro foi alterado.
- Nenhuma credencial ou identificador pessoal foi incluído neste documento.
- As 33 migrations locais e remotas estão alinhadas, da versão
  `202608190001` à `20260825014657`.
- O bucket `exercise-media` existe e permanece privado.

## Resumo executivo

| Métrica | Production atual | Gate v2.1 |
| --- | ---: | ---: |
| Exercícios ativos | 35 | preservar/expandir |
| Exercícios inativos | 0 | informativo |
| Exercícios ativos media-ready | 10 | mínimo 24; preferencial 30+ |
| Cobertura media-ready do catálogo ativo | 28,6% | ampliar |
| Registros de mídia | 44 | informativo |
| PRIMARY_DEMO aprovados | 10 | um por exercício elegível |
| Slots no plano ativo | 18 | aproximadamente 18 |
| Exercícios únicos no plano ativo | 9 | mínimo 12; preferencial 13–15 |
| Unicidade do plano ativo | 50% | mínimo 66,7% para 18 slots |
| Cobertura de mídia do plano ativo | 100% | 100% |
| Maior frequência do mesmo exercício | 2 dias | máximo 2 dias |
| Sobreposição entre pares de dias | 50% | máximo 50% |
| Padrões de movimento no plano | 8 | mínimo 8 |
| Usuários Auth | 1 | segundo usuário ainda pendente |
| Perfis | 1 | deve acompanhar Auth após novo cadastro |

O produto atual preserva 100% de mídia no plano e já respeita o limite de
frequência e sobreposição. O déficit objetivo é o pool media-ready (10, contra
24) e, por consequência, a diversidade do plano (9 únicos, contra 12).

## Catálogo ativo e elegibilidade atual

`active`, media readiness e elegibilidade para geração são conceitos distintos.
Na implementação capturada, o gerador filtra exercícios ativos com mídia
aprovada e equipamento compatível, mas ainda não existe uma única abstração
canônica que exponha e explique os três estados separadamente. A v2.1 deve
centralizar essa regra antes de publicar um novo plano.

| Slug | Padrão | Media-ready | Registros de mídia |
| --- | --- | --- | ---: |
| bike | cardio | não | 2 |
| calf-raise | knee_extension | não | 5 |
| chin-tuck | posture | não | 0 |
| dead-bug | core_anti_extension | não | 0 |
| elliptical | cardio | não | 0 |
| face-pull | posture | não | 0 |
| farmer-walk | carry | sim | 2 |
| goblet-squat | squat | sim | 3 |
| hack-squat | squat | não | 2 |
| hip-thrust | hip_extension | não | 0 |
| incline-machine-press | horizontal_push | não | 3 |
| incline-treadmill | cardio | não | 0 |
| lat-pulldown | vertical_pull | sim | 4 |
| lateral-raise | vertical_push | não | 0 |
| leg-extension | knee_extension | sim | 2 |
| leg-press | squat | sim | 4 |
| lying-leg-curl | knee_flexion | não | 1 |
| machine-chest-press | horizontal_push | sim | 2 |
| machine-fly | horizontal_push | não | 1 |
| machine-glute | hip_extension | não | 0 |
| machine-row | horizontal_pull | sim | 1 |
| machine-shoulder-press | vertical_push | sim | 3 |
| neutral-pulldown | vertical_pull | não | 1 |
| one-arm-row | horizontal_pull | não | 0 |
| pallof-press | core_anti_rotation | não | 0 |
| plank | core_anti_extension | sim | 1 |
| reverse-fly | posture | não | 0 |
| seated-leg-curl | knee_flexion | sim | 1 |
| seated-row | horizontal_pull | não | 1 |
| smith-squat | squat | não | 2 |
| supinated-pulldown | vertical_pull | não | 1 |
| thoracic-extension | mobility | não | 2 |
| treadmill | cardio | não | 0 |
| walking | cardio | não | 0 |
| wall-slide | posture | não | 0 |

Não há exercícios inativos no snapshot.

## Cobertura por padrão de movimento

| Padrão | Ativos | Media-ready | Lacuna |
| --- | ---: | ---: | ---: |
| cardio | 5 | 0 | 5 |
| carry | 1 | 1 | 0 |
| core_anti_extension | 2 | 1 | 1 |
| core_anti_rotation | 1 | 0 | 1 |
| hip_extension | 2 | 0 | 2 |
| horizontal_pull | 3 | 1 | 2 |
| horizontal_push | 3 | 1 | 2 |
| knee_extension | 2 | 1 | 1 |
| knee_flexion | 2 | 1 | 1 |
| mobility | 1 | 0 | 1 |
| posture | 4 | 0 | 4 |
| squat | 4 | 2 | 2 |
| vertical_pull | 3 | 1 | 2 |
| vertical_push | 2 | 1 | 1 |

Os gaps prioritários para diversidade estrutural são `hip_extension`,
`horizontal_pull`, `horizontal_push`, `core_anti_rotation`, `posture` e
`cardio`. Mídia de aquecimento/cardio não deve deslocar a cobertura dos padrões
de força exigidos pelo plano.

## Cobertura por músculo primário

| Músculo | Ativos | Media-ready |
| --- | ---: | ---: |
| antebraços | 1 | 1 |
| cardiovascular | 5 | 0 |
| coluna torácica | 1 | 0 |
| core | 4 | 2 |
| costas | 3 | 1 |
| deltoide lateral | 1 | 0 |
| deltoide posterior | 2 | 0 |
| estabilizadores escapulares | 1 | 0 |
| flexores cervicais | 1 | 0 |
| glúteos | 6 | 2 |
| latíssimo do dorso | 3 | 1 |
| ombros | 1 | 1 |
| panturrilhas | 1 | 0 |
| peitoral | 2 | 1 |
| peitoral superior | 1 | 0 |
| posteriores de coxa | 2 | 1 |
| quadríceps | 5 | 3 |
| trapézio | 1 | 0 |

## Estado de `exercise_media`

| Dimensão | Distribuição |
| --- | --- |
| Status | 10 `approved`, 18 `pending`, 1 `processed`, 15 `rejected` |
| Papel | 10 `PRIMARY_DEMO`, 34 sem papel publicado |
| Tipo | 17 GIF, 27 vídeo |
| Revisão | 10 `PUBLISHED`, 19 `MANUAL_REVIEW_REQUIRED`, 15 `REJECTED` |

O critério estrito usado nesta auditoria exige simultaneamente: exercício
ativo; exatamente um `PRIMARY_DEMO` aprovado e primário; execução aprovada;
licença reconhecida; origem, autor e atribuição presentes; animação validada
com mais de um frame; motion e poster existentes no bucket; e SHA-256 do motion
igual ao `content_hash` persistido.

Todos os 10 itens atualmente publicados passaram por download de leitura do
bucket e validação de existência, animação, proveniência, licença e hash.

| Exercício | Fonte | Licença | SHA-256 | Motion / poster |
| --- | --- | --- | --- | --- |
| farmer-walk | DVIDS | PD | `62bb655d0c6f1033fb5029f0ce3d28e73e93f60c1ffe58a2ea4e9feabe5f9d8a` | `exercises/farmer-walk/primary/62bb655d0c6f1033fb5029f0ce3d28e73e93f60c1ffe58a2ea4e9feabe5f9d8a.gif` / `.webp` |
| goblet-squat | Wikimedia Commons | CC-BY-SA-4.0 | `2fe6026ca687c84ef2a1f0e3587b8aa17dfab101c5210aa3a2c2c9450a9f9a37` | `exercises/goblet-squat/primary/2fe6026ca687c84ef2a1f0e3587b8aa17dfab101c5210aa3a2c2c9450a9f9a37.gif` / `.webp` |
| lat-pulldown | Wikimedia Commons | CC-BY-3.0 | `b25b7fe9d9f0ce1aa829a2c076c8591290a8b85e5fcca59c41d224068a097bcb` | `exercises/lat-pulldown/primary/b25b7fe9d9f0ce1aa829a2c076c8591290a8b85e5fcca59c41d224068a097bcb.mp4` / `.webp` |
| leg-extension | Wikimedia Commons | PD | `9c69c89d9099661a4babd219bc9b57b95140edbbcb002f83cb5b93d572543493` | `exercises/leg-extension/primary/9c69c89d9099661a4babd219bc9b57b95140edbbcb002f83cb5b93d572543493.gif` / `.webp` |
| leg-press | Wikimedia Commons | PD | `cf32752060a224e80d167f096331205841e7ddc4ec4b7d421da7883aecffff7d` | `exercises/leg-press/primary/cf32752060a224e80d167f096331205841e7ddc4ec4b7d421da7883aecffff7d.gif` / `.webp` |
| machine-chest-press | Wikimedia Commons | PD | `c9f99ca69a26c888b87953e95ef9b1c3d4be12037b13ed207671d4a41ba4912d` | `exercises/machine-chest-press/primary/c9f99ca69a26c888b87953e95ef9b1c3d4be12037b13ed207671d4a41ba4912d.gif` / `.webp` |
| machine-row | Wikimedia Commons | PD | `c3b427f6c66bacd1818062e02aa377f8eb28104f195f8fbc399fcaeae921644b` | `exercises/machine-row/primary/c3b427f6c66bacd1818062e02aa377f8eb28104f195f8fbc399fcaeae921644b.gif` / `.webp` |
| machine-shoulder-press | Wikimedia Commons | PD | `a71ff463a30988ceac803a4d6ca81bee28f67966941c357f8c78d0d02ae402d8` | `exercises/machine-shoulder-press/primary/a71ff463a30988ceac803a4d6ca81bee28f67966941c357f8c78d0d02ae402d8.gif` / `.webp` |
| plank | DVIDS | PD | `750a45d306d0fbfe7929090bd0407d33f741f0fd509db3ff6697c0919950277e` | `exercises/plank/primary/750a45d306d0fbfe7929090bd0407d33f741f0fd509db3ff6697c0919950277e.gif` / `.webp` |
| seated-leg-curl | Wikimedia Commons | PD | `45a0cc51ebe9cc07eb94b14fae1ddd1a9d80d14e3ddaac7fcc26f88785054cf0` | `exercises/seated-leg-curl/primary/45a0cc51ebe9cc07eb94b14fae1ddd1a9d80d14e3ddaac7fcc26f88785054cf0.gif` / `.webp` |

As URLs canônicas de origem e os textos completos de atribuição continuam no
banco. Este relatório mantém apenas a fonte e a licença para ser legível; o
auditor versionado verifica os campos completos.

## Plano ativo atual

| Dia | Exercícios |
| --- | --- |
| Full Body A | lat-pulldown, leg-extension, seated-leg-curl, machine-shoulder-press, farmer-walk, goblet-squat |
| Full Body B | leg-press, plank, machine-chest-press, lat-pulldown, leg-extension, seated-leg-curl |
| Full Body C | machine-shoulder-press, farmer-walk, goblet-squat, leg-press, plank, machine-chest-press |

- 18 slots, 9 exercícios únicos e 50% de unicidade.
- Cada exercício aparece exatamente duas vezes; nenhum aparece nos três dias.
- Sobreposição A/B, A/C e B/C: 50% em todos os pares.
- Distribuição: `squat` 4; e `carry`, `core_anti_extension`,
  `horizontal_push`, `knee_extension`, `knee_flexion`, `vertical_pull` e
  `vertical_push` com 2 slots cada.
- 8 padrões distintos e 100% dos slots media-ready.

O plano deve permanecer ativo e intacto até que catálogo, mídia, gerador e
novo plano passem juntos por todos os gates v2.1.

## Preferências, equipamento e histórico

- Perfil auditado: administrador, onboarding concluído.
- Experiência: `returning`; 3 sessões/semana; 60 minutos; preferência de
  cardio `1`.
- 7 objetivos registrados.
- 15 tipos de equipamento disponíveis: `abductor`, `adductor`, `barbell`,
  `bench`, `bike`, `bodyweight`, `cable`, `chest-press`, `dumbbells`,
  `lat-pulldown`, `leg-extension`, `leg-press`, `lying-leg-curl`,
  `seated-leg-curl`, `treadmill`.
- Nenhuma preferência explícita por exercício.
- Uma sessão em andamento; o fluxo de publicação não pode reescrevê-la.

## Substituições

A tabela de substituições não é legível pela credencial operacional atual por
decisão de least privilege. A auditoria não elevou grants e não contornou RLS.
Antes de qualquer publicação v2.1, será criada e testada localmente uma leitura
canônica mínima, sem acesso irrestrito a dados pessoais, para validar contagem,
compatibilidade, mídia e ausência de auto-substituição. Isso é uma limitação de
observabilidade do baseline, não autorização para mudar Production.

## Decisão do baseline

`V21_BASELINE_CAPTURED_READ_ONLY`

Os dados atuais estão íntegros e preservados, porém Production ainda não atende
ao gate final v2.1. Próximos trabalhos autorizados no repositório: abstrações
canônicas, migrations idempotentes, expansão de mídia licenciada, gerador
determinístico e testes. Qualquer write remoto continua condicionado aos gates
locais e ao dry-run correspondente.
