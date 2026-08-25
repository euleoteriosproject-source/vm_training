# V20 User Acceptance Test

## Automação concluída

- [x] 33/33 E2E locais.
- [x] Chromium mobile, WebKit/iPhone 13 e desktop.
- [x] Signup permitido/negado, login e persistência.
- [x] Plano, mídia, treino, histórico, progresso e rotas admin locais.
- [x] Zero skip por senha real.
- [x] Nenhuma credencial de pessoa real armazenada.
- [x] Production HTTPS saudável em `https://vm-training.vercel.app`.
- [x] Login desktop e cadastro mobile renderizados sem erro de console.

## ACTION REQUIRED — SECOND REAL USER ONBOARDING

A segunda pessoa deve acessar `https://vm-training.vercel.app` e pessoalmente:

- [ ] Criar a conta com o e-mail allowlisted e senha privada.
- [ ] Concluir o onboarding de três etapas.
- [ ] Gerar/receber o plano e abrir o app.
- [ ] Validar home, treino próprio, GIF, sets, progresso, histórico e perfil.

Após isso, verificar somente por leitura: 2 usuários, 2 profiles, 1 admin, 1 member, onboarding completo e plano do membro com 100% PRIMARY.

## ACTION REQUIRED — ADMIN IPHONE UAT

- [ ] Login e persistência no Safari.
- [ ] Home, Body Intelligence e os três dias de treino.
- [ ] Detalhes/GIF, início, registro, retomada, conclusão parcial e cancelamento.
- [ ] Histórico/carga anterior, substituição e desfazer.
- [ ] Tema claro/escuro, logout e novo login.

Status: `BLOCKED` somente pelos dois gates humanos e pelas auditorias posteriores.
