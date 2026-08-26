# VM Training v2.1 — Media Expansion

## Resultado

| Métrica | Antes | Depois |
| --- | ---: | ---: |
| Catálogo ativo | 35 | 60 |
| PRIMARY media-ready | 10 | 36 |
| Cobertura | 28,6% | 60% |
| Pool auto-plan elegível do admin | não centralizado | 30 |

Foram publicados **26 novos PRIMARY_DEMO**: 25 GIFs animados e um vídeo
fallback (`walking`). O pipeline reproduziu 26/26 artefatos antes e durante o
apply, validou hash remoto, poster, duração e frame count e publicou via RPC
restrita a `service_role`.

## Assets promovidos

`barbell-bench-press`, `bent-over-barbell-row`, `conventional-deadlift`,
`pull-up`, `standing-barbell-press`, `barbell-back-squat`,
`incline-barbell-press`, `hanging-straight-leg-raise`, `hanging-knee-raise`,
`knee-push-up`, `bodyweight-half-squat`, `seated-dumbbell-overhead-press`,
`alternating-superman`, `bilateral-superman`, `standing-toe-raise`,
`back-extension-machine`, `burpee`, `walking`, `sumo-deadlift`,
`suitcase-carry`, `chair-squat`, `dumbbell-floor-press`,
`standing-chest-stretch`, `seated-hamstring-stretch`, `high-to-low-plank` e
`side-plank`.

As fontes versionadas estão em `data/media/media-v21.json`; os manifests de
descoberta e revisão permanecem em `data/media/`. As decisões são identificadas
como validação automatizada assistida (`humanReviewClaimed: false`). Nenhum
revisor humano foi inventado.

## Integridade final

| Gate | Resultado |
| --- | ---: |
| DB_WITHOUT_FILE | 0 |
| FILE_WITHOUT_DB | 0 |
| HASH_MISMATCH | 0 |
| GIF_SINGLE_FRAME | 0 |
| DUPLICATE_PRIMARY | 0 |
| STATIC_PRIMARY | 0 |
| INVALID_LICENSE | 0 |
| INVALID_PROVENANCE | 0 |

O bucket `exercise-media` continua **PRIVATE**. Existem 74 objetos referenciados
por registros de mídia e 36 PRIMARY aprovadas; o plano ativo usa 14/14 assets
com motion, poster, licença, proveniência e SHA-256 válidos.

## Itens restantes

Vinte e quatro exercícios ativos continuam sem PRIMARY validada. Eles não foram
apagados nem falsamente aprovados e são excluídos do auto-plan enquanto a regra
canônica retornar `media_not_ready`. O pool final de 36 supera o mínimo 24 e o
alvo preferencial 30+ da release.
