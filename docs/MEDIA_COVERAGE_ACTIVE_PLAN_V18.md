# VM Training v1.8 — cobertura de mídia do plano ativo

Data da auditoria: 2026-08-22

Projeto: `inghftngeritrsezwxnm`

Regra: somente `approved + approved + PRIMARY_DEMO + is_primary` é exibido.

## Resultado

- Plano ativo: 18 exercícios únicos.
- PRIMARY aprovado e visualmente validado: 4/18 (22,2%).
- Sem PRIMARY aprovado: 14/18 (77,8%).
- Promoções nesta rodada: 0.
- Nenhum treino é bloqueado pela ausência de mídia. A interface usa um fallback
  compacto e mantém instruções, prescrição, respiração, erros, equipamentos e
  substituição acessíveis.

Os quatro exercícios cobertos continuam sendo `leg-extension`,
`seated-leg-curl`, `goblet-squat` e `machine-row`. Esta rodada não altera os
assets ou metadados que já foram aprovados.

## Auditoria dos 14 exercícios sem PRIMARY

| Exercício | Candidato/referência revisada | Constatação visual/semântica | Decisão v1.8 |
|---|---|---|---|
| `machine-fly` | Wikimedia, *Muscle Strengthening at the Gym - Chest Press* | É chest press: há extensão de cotovelos e empurrão, não o arco de adução do pec-deck. | REJECT; manter sem PRIMARY |
| `dead-bug` | Descoberta Wikimedia expandida | Nenhum resultado com execução completa e correspondência segura; resultados foram eliminados por equipamento/movimento incorreto. | NO_SUITABLE_CANDIDATE |
| `machine-shoulder-press` | Wikimedia, *Shoulder press - exercise demonstration* e tutorial com halteres | Um vídeo é desenvolvimento em pé com barra; o outro usa banco e halteres. Nenhum mostra a máquina dedicada do catálogo. | REJECT; manter candidatos sem publicação |
| `lateral-raise` | Descoberta Wikimedia expandida | Nenhuma demonstração licenciada e inequívoca passou o limiar de correspondência. | NO_SUITABLE_CANDIDATE |
| `face-pull` | Descoberta Wikimedia expandida | Nenhuma demonstração licenciada e inequívoca passou o limiar de correspondência. | NO_SUITABLE_CANDIDATE |
| `farmer-walk` | Wikimedia, *Kettlebell Farmer Walks* | Mostra suitcase carry unilateral com um kettlebell; o catálogo exige carga bilateral. | REJECT; manter sem PRIMARY |
| `machine-glute` | Descoberta Wikimedia expandida | Nenhum resultado mostra de forma inequívoca a máquina de glúteos e uma repetição completa. | NO_SUITABLE_CANDIDATE |
| `hip-thrust` | Descoberta Wikimedia expandida | Nenhum resultado licenciado passou os critérios de enquadramento, equipamento e ciclo completo. | NO_SUITABLE_CANDIDATE |
| `lat-pulldown` | Wikimedia: tutorial *Common Lat Pulldown Mistakes*, dois GIFs de posição e um leg press associado incorretamente | O tutorial é pronado e útil, mas a licença segue em revisão; os GIFs mostram poses isoladas; o leg press é associação incorreta. | KEEP_PENDING para o tutorial; demais REJECT |
| `neutral-pulldown` | Mesmo tutorial de pulldown | A pegada visível é pronada e aberta, não neutra/palmas frente a frente. | REJECT para esta variação |
| `supinated-pulldown` | Mesmo tutorial de pulldown | A pegada visível é pronada, não supinada. | REJECT para esta variação |
| `seated-row` | Wikimedia, *Muscle Strengthening at the Gym - Row Machine* | Movimento horizontal correto, mas é máquina seletorizada/alavanca; o exercício esperado é remada baixa no cabo. | REJECT para este slug; não duplicar `machine-row` |
| `one-arm-row` | Descoberta Wikimedia expandida | Nenhuma demonstração licenciada com remada unilateral e equipamento compatível passou o limiar. | NO_SUITABLE_CANDIDATE |
| `reverse-fly` | Descoberta Wikimedia expandida | Nenhuma demonstração licenciada e inequívoca passou o limiar. | NO_SUITABLE_CANDIDATE |

## Referências de identificação

A comparação reutilizou a revisão visual versionada da v1.5 e as referências
técnicas já auditadas: [ACE Seated Chest Press](https://www.acefitness.org/resources/everyone/exercise-library/188/seated-chest-press/),
[ACE Seated Shoulder Press](https://www.acefitness.org/resources/everyone/exercise-library/186/seated-shoulder-press/),
[ACE Farmer's Carry](https://www.acefitness.org/resources/everyone/exercise-library/359/farmer-s-carry/),
[Mayo Clinic Lat Pull-down](https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/lat-pull-down/vid-20084683),
[ACE Seated Row](https://www.acefitness.org/resources/everyone/exercise-library/48/seated-row/)
e [Mayo Clinic Seated Row](https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/seated-row/vid-20084688).

As páginas individuais em `docs/media-validation/exercises/` continuam sendo o
registro detalhado de fonte, licença, equipamento, movimento, qualidade e
pontuação. O dataset sanitizado continua versionado em
`data/media/media-candidates.json`.

## Execução da nova descoberta

`pnpm media:rediscover` foi executado em `--dry-run --missing-only --expanded`.
A API pública demorou além de 10 minutos e o processo terminou por timeout após
atualizar apenas o artefato operacional ignorado em `.tmp`. Esse resultado
parcial não substitui o dataset versionado e não autoriza promoção. Entre os
exercícios do plano alcançados antes do timeout, `machine-fly` voltou a apontar
para o chest press já rejeitado; os demais não produziram um candidato seguro.

## Critério para a próxima promoção

Uma mídia só pode avançar quando, simultaneamente:

1. fonte original e licença estão verificadas;
2. equipamento e variação correspondem ao slug;
3. a repetição mostra início, amplitude e retorno com enquadramento útil;
4. não há associação conhecida como incorreta;
5. a revisão humana visual aprova o uso como `PRIMARY_DEMO`.

Até lá, 4/18 é a cobertura correta. Aumentar esse número com variações erradas
seria uma regressão de qualidade.
