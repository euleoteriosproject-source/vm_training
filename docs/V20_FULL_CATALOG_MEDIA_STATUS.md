# V20 Full Catalog Media Status

O catálogo e o pool de geração são conceitos distintos.

| Métrica                        | Resultado |
| ------------------------------ | --------: |
| Exercícios no catálogo         |        35 |
| PRIMARY aprovadas              |        10 |
| Sem PRIMARY aprovada           |        25 |
| Cobertura integral do catálogo |     28,6% |
| Cobertura do plano Production  |      100% |

## Exercícios fora do pool media-ready

`hack-squat`, `smith-squat`, `lying-leg-curl`, `hip-thrust`, `machine-glute`, `calf-raise`, `neutral-pulldown`, `supinated-pulldown`, `seated-row`, `one-arm-row`, `reverse-fly`, `face-pull`, `incline-machine-press`, `machine-fly`, `lateral-raise`, `dead-bug`, `pallof-press`, `wall-slide`, `chin-tuck`, `thoracic-extension`, `treadmill`, `incline-treadmill`, `bike`, `elliptical` e `walking`.

Esses exercícios não foram apagados nem semanticamente desativados. O gerador v2.0 filtra por `active && exercise_has_approved_primary(id)` e bloqueia a geração se o pool compatível não puder formar um plano seguro.

Há 19 candidatos ainda em estados operacionais (`pending`, `reviewing`, `processing`, `processed` ou `failed`). Nenhum foi promovido para completar números artificialmente.
