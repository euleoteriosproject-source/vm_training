# Media Processing v1.6 — GIF-FIRST

## Resultado

O lote v1.6 processa somente os sete candidatos `PRIMARY_DEMO` aprovados na validação v1.5. Os 31 candidatos rejeitados não entram no pipeline e os dois candidatos pendentes permanecem sem alteração.

Cada mídia final segue estas regras:

- GIF animado é o formato preferencial; MP4 só é aceito como fallback documentado.
- Duração entre 4 e 12 segundos, 12 fps, loop infinito e uma a três repetições completas.
- Largura máxima de 480 px, sem ampliar fontes menores.
- Geração com `palettegen` e `paletteuse`.
- Limite preferencial de 5 MB e limite excepcional de 8 MB.
- Poster WebP é secundário e nunca conta como cobertura animada.
- Caminho imutável por SHA-256: `exercises/<slug>/primary/<hash>.gif` e `<hash>.webp`.

Os cortes foram escolhidos por folhas de contato temporárias e confirmados novamente nos GIFs finais:

| Exercício                |   Corte | Evidência visual                                |
| ------------------------ | ------: | ----------------------------------------------- |
| Leg press                | 34–41 s | flexão, extensão e retorno completos            |
| Goblet squat             |  3–15 s | posição inicial, descida, fundo e retorno em pé |
| Extensão de pernas       | 29–35 s | extensão e retorno completos, máquina visível   |
| Flexão de pernas sentada | 23–31 s | extensão, flexão e retorno completos            |
| Remada máquina           | 13–22 s | alcance, puxada e retorno completos             |
| Chest press máquina      | 15–24 s | extensão, retorno e nova extensão completos     |
| Bicicleta                |   0–9 s | ciclo contínuo e legível                        |

## Comandos

```bash
pnpm media:process:v16
node --experimental-strip-types scripts/media/process-primary-v16.ts --dry-run --confirm-visual
node --experimental-strip-types scripts/media/process-primary-v16.ts --apply --confirm-visual
pnpm media:manifest-check
pnpm media:reconcile
```

O primeiro comando é sempre um dry-run local e não envia arquivos. `--apply` usa o destino configurado e recusa um host não local sem `--allow-production`. A publicação só ocorre depois de `--confirm-visual`.

## Invariantes

Uma `PRIMARY_DEMO` aprovada nunca pode ter `media_type='image'`. GIF exige `animation_verified=true`, mais de um frame, duração positiva, loop e ausência de fallback. Vídeo exige duração positiva, animação verificada e um motivo explícito:

- `GIF_SIZE_TOO_LARGE`
- `GIF_QUALITY_INSUFFICIENT`
- `GIF_MOTION_DEGRADED`
- `GIF_PROCESSING_FAILED`

A reconciliação reporta `DB_WITHOUT_FILE`, `FILE_WITHOUT_DB`, `HASH_MISMATCH`, `APPROVED_WITHOUT_ANIMATION`, `APPROVED_WITHOUT_POSTER`, `GIF_SINGLE_FRAME`, `PRIMARY_STATIC_IMAGE` e `DUPLICATE_PRIMARY`.

## Artefatos

- `data/media/media-processing-v16.json`: relatório técnico e operacional do lote.
- `data/media/primary-media-manifest.json`: identidade imutável, licença e metadados de animação das sete mídias finais.
- `.tmp/media-processing/v16/`: GIFs, posters e folhas de contato operacionais; permanece ignorado.

## Production

O ambiente usado para esta rodada é local. O dry-run, a inspeção visual e a validação técnica podem ser concluídos sem alterar Production. Upload, publicação e reconciliação de Production exigem que as variáveis operacionais sejam configuradas localmente e que o comando seja repetido com `--apply --confirm-visual --allow-production`. Valores secretos nunca devem ser incluídos em documentação, artefatos ou logs.
