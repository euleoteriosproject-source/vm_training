# VM Training v2.1 — Final Technical Report

## Production data

- Supabase project: `inghftngeritrsezwxnm`.
- Auth users/profiles/onboarded: 1/1/1, preservados.
- Active/media-ready/eligible: 60/36/30.
- Media integrity: todos os contadores bloqueantes em zero.
- Admin plan: 3 dias, 18 slots, 14 únicos, 77,8% de unicidade, overlaps
  0/33,3/33,3%, 9 padrões, mídia 100%, inválidos 0, inelegíveis 0.
- Sessões em andamento preservadas: 1.

## Automated gates

- Lint: PASS.
- Typecheck: PASS.
- Unit: 79/79 PASS.
- pgTAP: 169/169 PASS.
- E2E: 36/36 PASS.
- Build: PASS.
- Dependency audit: nenhuma vulnerabilidade high/critical conhecida.
- Secret scan: 0 achados em artefatos de release.

## Release gate

O código, banco, mídia e plano estão tecnicamente prontos. O gate público final
depende ainda do deploy/smoke desta revisão e dos UATs pessoais registrados em
`V21_UAT.md`. A segunda pessoa real não foi simulada.
