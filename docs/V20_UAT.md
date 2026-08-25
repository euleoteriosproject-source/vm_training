# V20 User Acceptance Test

UAT humano é obrigatório e não pode ser substituído por Playwright.

## Admin existente — iPhone real

- [ ] Abrir a URL HTTPS final.
- [ ] Entrar digitando a senha diretamente no aparelho.
- [ ] Confirmar persistência após fechar/reabrir o Safari.
- [ ] Ver plano ativo e os três dias.
- [ ] Abrir detalhe e expandir GIF/vídeo.
- [ ] Retomar a sessão já em andamento.
- [ ] Registrar kg/reps e concluir uma série.
- [ ] Ver confirmação explícita de conclusão parcial.
- [ ] Ver histórico e cargas anteriores.
- [ ] Testar substituição, indisponibilidade temporária e desfazer.
- [ ] Ver peso, altura, IMC, interpretação e histórico.
- [ ] Sair e entrar novamente.

## Segunda pessoa real allowlisted — navegador real

- [ ] Criar a conta com o e-mail já autorizado.
- [ ] Confirmar role `member` e ausência de acesso admin.
- [ ] Concluir onboarding com dados pessoais fornecidos pela própria pessoa.
- [ ] Confirmar fluxo em até três telas, data DD/MM/AAAA e preset de academia.
- [ ] Gerar plano e confirmar 100% de mídia.
- [ ] Iniciar, registrar, retomar, cancelar e concluir treino.
- [ ] Confirmar isolamento direto entre os dois usuários.

## Automação disponível

- Chromium mobile, WebKit iPhone 13 e desktop configurados.
- Viewports: 375×812, 390×844, 430×932 e 1440×900.
- Testes públicos executados: 6 PASS.
- Testes autenticados: 27 SKIPPED, porque nenhuma senha real foi armazenada.

Status atual: `BLOCKED` até as duas seções humanas passarem.
