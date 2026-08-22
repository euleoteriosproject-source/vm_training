# VM Training v1.7 — Final Media Validation

Revisão visual e técnica executada em 21/08/2026 sobre os sete artefatos `processed` do bucket privado `exercise-media`. Os GIFs e posters remotos foram baixados, seus SHA-256 foram comparados ao manifesto e cada animação foi inspecionada em contact sheet. A fonte canônica, licença, equipamento, exercício, posição inicial, amplitude, repetição completa, clareza e enquadramento foram conferidos.

O registro versionável e machine-readable está em `data/media/media-final-validation-v17.json`. O executor reproduzível está em `scripts/media/finalize-v17.ts` e exige `--apply` para escrita.

## Resultado

| Exercício | Decisão | Fundamentação resumida |
| --- | --- | --- |
| leg-press | `APPROVE_PRIMARY` | Leg press sentado, movimento e equipamento inequívocos. |
| goblet-squat | `APPROVE_PRIMARY` | Kettlebell em goblet grip e agachamento completo visível. |
| leg-extension | `APPROVE_PRIMARY` | Extensora sentada e extensão de joelho claramente demonstradas. |
| seated-leg-curl | `APPROVE_PRIMARY` | Flexora sentada, sem confusão com variação deitada. |
| machine-row | `APPROVE_PRIMARY` | Remada em máquina e trajetória de puxada visíveis. |
| machine-chest-press | `APPROVE_PRIMARY` | Chest press horizontal, sem confusão com pec deck. |
| bike | `KEEP_PROCESSED` | Movimento de pedalar correto, mas a representação estilizada de 75×100 não oferece detalhe instrucional suficiente para PRIMARY. |

Totais: 7 revisados, 6 aprovados como `PRIMARY_DEMO`, 0 educacionais, 1 mantido como `processed` e 0 rejeitados.

## Fontes e validação cruzada

As fontes primárias são os arquivos do Wikimedia Commons registrados no manifesto: [seated leg press](https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Seated_Leg_Press.webm), [goblet squat](https://commons.wikimedia.org/wiki/File:Kettlebell_Goblet_Squat.webm), [leg extension](https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Leg_Extension.webm), [leg curl](https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Leg_Curl.webm), [row machine](https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Row_Machine.webm), [chest press](https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm) e [exercise bike](https://commons.wikimedia.org/wiki/File:Man_on_an_Exercise_Bike_GIF_Animation_Loop.gif).

A identificação técnica foi comparada às bibliotecas de exercícios da [NASM para goblet squat](https://www.nasm.org/resource-center/exercise-library/goblet-squat) e da ACE para [seated leg press](https://www.acefitness.org/resources/everyone/exercise-library/154/seated-leg-press/), [seated row](https://www.acefitness.org/resources/everyone/exercise-library/168/seated-row/) e [seated chest press](https://www.acefitness.org/resources/everyone/exercise-library/188/seated-chest-press/).

## Publicação

As seis decisões PRIMARY foram gravadas com `reviewed_by` e `approved_by` resolvidos a partir do perfil do admin real e publicadas por `publish_exercise_media`. O GIF da bike não recebeu campos de aprovação nem PRIMARY. O bucket permanece privado e o aplicativo usa URLs assinadas.
