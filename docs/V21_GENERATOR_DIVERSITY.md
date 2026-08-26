# VM Training v2.1 — Generator Diversity

## Estratégia

O gerador `v2.1.0` é determinístico. Segurança, restrições de movimento,
equipamento, dificuldade e mídia são gates de elegibilidade; objetivo,
preferência, distribuição semanal, diversidade e histórico recente participam
do ranking. Falhas de pool ou diversidade geram diagnóstico e bloqueiam a
ativação.

O banco recalcula as métricas e só ativa o plano em uma transação que:

1. valida todos os exercícios;
2. cria a nova versão;
3. arquiva o plano ativo anterior;
4. ativa o novo plano;
5. preserva planos, sessões e histórico anteriores.

## Antes e depois — admin real

| Métrica | v2.0 | v2.1 |
| --- | ---: | ---: |
| Dias | 3 | 3 |
| Slots | 18 | 18 |
| Exercícios únicos | 9 | 14 |
| Unicidade | 50% | 77,8% |
| Frequência exata máxima | 2 | 2 |
| Exercício em A+B+C | 0 | 0 |
| A/B overlap | 50% | 0% |
| A/C overlap | 50% | 33,3% |
| B/C overlap | 50% | 33,3% |
| Padrões distintos | 8 | 9 |
| Cobertura de mídia | 100% | 100% |
| Equipamento inválido | 0 | 0 |
| Exercício inelegível | 0 | 0 |

O novo plano usa 30 exercícios elegíveis como pool e 14 diferentes nos 18
slots. A distribuição semanal é: `squat` 3; `hinge`, `horizontal_pull`,
`horizontal_push`, `posture`, `vertical_pull`, `vertical_push` e
`core_anti_extension` 2; `core_anti_rotation` 1.

Uma sessão que já estava em andamento foi preservada. O plano anterior foi
arquivado, não removido.

## Testes

- Caso padrão 3 dias/18 slots: diversidade, overlaps, mídia, equipamento e
  movimento.
- Usuário restrito: nenhuma seleção incompatível e diagnóstico quando o pool é
  insuficiente.
- Versionamento e ativação atômica: pgTAP.
- Resultado final: unit 79/79 e pgTAP 169/169.
