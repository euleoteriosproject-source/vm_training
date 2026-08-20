# VM Training — Production Runbook

## Health check

1. Abra `https://<dominio>/api/health` e confirme HTTP 200, `status: ok` e `app: vm-training`.
2. Execute `PRODUCTION_URL=https://<dominio> pnpm smoke:production`.
3. Confirme que `/login` mostra o VM Training e não a autenticação da Vercel.

## Login falhando

1. Verifique o health endpoint e o status do Supabase Auth.
2. Confirme `NEXT_PUBLIC_SUPABASE_URL`, publishable key, Site URL e Redirect URLs.
3. Verifique o Before User Created Hook e a allowlist ativa sem expô-la ao usuário.
4. Nunca registre senha, access token ou refresh token durante o diagnóstico.

## Supabase indisponível

Confirme o status do projeto, limites, região e conectividade. Não troque para outro banco nem desative RLS como contorno. Restaure o serviço e valide Auth, REST e Storage antes de liberar uso.

## Falha de migration

Interrompa o deploy. Compare `supabase migration list`, preserve o banco e crie uma migration de forward-fix. Não faça rollback destrutivo. Rode pgTAP/RLS e `release:check --mode production` novamente.

## Storage ou mídia quebrada

1. Confirme bucket `exercise-media`, objeto, poster e policies.
2. Desative o exercício antes de retirar uma PRIMARY_DEMO em uso.
3. Preserve a mídia anterior como arquivada/inativa para rollback.
4. Processe e revise a substituta, publique e valide o plano novamente.

## Vercel deployment failure

Revise build logs e env vars por ambiente sem imprimir valores secretos. Corrija em novo commit/deployment. Preview pode ser protegido; Production deve permanecer pública na camada Vercel.

## Rollback Vercel

No dashboard da Vercel, abra Deployments, selecione o último deployment saudável e use Promote to Production/Rollback. Depois execute o smoke e confirme que migrations novas continuam compatíveis; mudanças de banco são corrigidas para frente.

## Incidente de RLS

Bloqueie o release, preserve logs sem dados corporais completos, reproduza com pgTAP e corrija por migration. Valide que Vinicius e Marlise não conseguem consultar perfis, medidas, sessões ou séries um do outro. Admin de catálogo não deve receber acesso implícito a dados privados.
