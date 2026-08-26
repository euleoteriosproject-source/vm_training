# VM Training v2.1 — UAT

## Automação concluída

| Fluxo | Resultado |
| --- | --- |
| Auth same-origin / login / signup / conta existente / allowlist | PASS |
| Onboarding e sessão | PASS |
| Home e navegação autenticada | PASS |
| Treino, resume, bloqueio de conclusão vazia e cancelamento | PASS |
| Histórico, valores anteriores e body intelligence neutra | PASS |
| Mídia animada e detalhe do exercício | PASS |
| Substituição/ACL/RLS | PASS |
| Biblioteca, busca e detalhe media-ready | PASS |
| Mobile Chromium | 12/12 PASS |
| WebKit/iPhone 13 | 12/12 PASS |
| Desktop Chromium | 12/12 PASS |

## Produção — checklist humano pendente

O SDD proíbe marcar observação humana automaticamente. O admin real deve abrir
Production HTTPS e confirmar pessoalmente:

- Home, biblioteca e os três dias do novo plano.
- A/B/C parecem de fato distintos.
- GIF/vídeo, detalhe, início, registro, histórico e valores anteriores.
- Substituição, undo, retomar, conclusão parcial e cancelamento.
- iPhone real e desktop, tema claro/escuro e ausência de overflow.

## Segundo usuário real

`ACTION_REQUIRED_SECOND_USER`

A segunda pessoa deve executar signup e onboarding pessoalmente. Não foi criada
conta aleatória em Production. Depois disso, gerar seu plano v2.1 e auditar
isolamento, mídia 100%, equipamentos e diversidade sem copiar o plano do admin.
