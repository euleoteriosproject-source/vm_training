-- VM Training v2.1: expand the active catalog independently from media
-- readiness. Media publication remains a separate, provenance-gated step.

begin;

insert into public.equipment(slug, name) values
  ('pull-up-bar', 'Barra fixa'),
  ('back-extension-machine', 'Máquina de extensão lombar')
on conflict(slug) do update set name = excluded.name, active = true;

insert into public.exercises(
  slug, name_pt, name_en, category, movement_pattern,
  primary_muscles, secondary_muscles, difficulty,
  execution_instructions, breathing_instruction, common_errors, active
) values
  ('barbell-bench-press', 'Supino reto com barra', 'Barbell bench press', 'strength', 'horizontal_push',
    array['peitoral'], array['tríceps','deltoide anterior'], 'intermediate',
    array['Apoie cabeça, escápulas e pés','Desça a barra com controle até o peito','Empurre mantendo punhos alinhados'],
    'Inspire ao descer e expire ao empurrar', array['Abrir demais os cotovelos','Perder o apoio dos pés'], true),
  ('bent-over-barbell-row', 'Remada curvada com barra', 'Bent-over barbell row', 'strength', 'horizontal_pull',
    array['costas'], array['bíceps','deltoide posterior','core'], 'intermediate',
    array['Incline o tronco com coluna neutra','Puxe a barra em direção ao abdômen','Desça sem perder a posição do tronco'],
    'Expire ao puxar', array['Arredondar a lombar','Usar balanço excessivo'], true),
  ('conventional-deadlift', 'Levantamento terra convencional', 'Conventional deadlift', 'strength', 'hinge',
    array['posteriores de coxa','glúteos'], array['costas','core'], 'intermediate',
    array['Posicione a barra junto às canelas','Estenda quadris e joelhos mantendo a coluna neutra','Retorne levando o quadril para trás'],
    'Trave o tronco antes de tirar a barra do chão e expire no topo', array['Afastar a barra do corpo','Arredondar a coluna'], true),
  ('pull-up', 'Barra fixa pronada', 'Pull-up', 'strength', 'vertical_pull',
    array['latíssimo do dorso'], array['bíceps','core'], 'intermediate',
    array['Comece com os braços estendidos e escápulas ativas','Puxe o peito em direção à barra','Desça com controle'],
    'Expire ao subir', array['Balançar o corpo','Encolher os ombros'], true),
  ('standing-barbell-press', 'Desenvolvimento em pé com barra', 'Standing barbell press', 'strength', 'vertical_push',
    array['ombros'], array['tríceps','core'], 'intermediate',
    array['Segure a barra na altura dos ombros','Empurre acima da cabeça mantendo o tronco firme','Desça com controle'],
    'Expire ao empurrar', array['Hiperestender a lombar','Projetar a barra muito à frente'], true),
  ('barbell-back-squat', 'Agachamento livre com barra', 'Barbell back squat', 'strength', 'squat',
    array['quadríceps','glúteos'], array['posteriores de coxa','core'], 'intermediate',
    array['Apoie a barra de forma estável nas costas','Agache mantendo pés firmes e joelhos alinhados','Suba estendendo quadris e joelhos juntos'],
    'Inspire antes de descer e expire ao concluir a subida', array['Joelhos colapsando para dentro','Perder a neutralidade da coluna'], true),
  ('incline-barbell-press', 'Supino inclinado com barra', 'Incline barbell press', 'strength', 'horizontal_push',
    array['peitoral superior'], array['tríceps','deltoide anterior'], 'intermediate',
    array['Ajuste o banco inclinado e apoie os pés','Desça a barra ao alto do peito','Empurre sem elevar os ombros'],
    'Inspire ao descer e expire ao empurrar', array['Inclinação excessiva do banco','Quicar a barra no peito'], true),
  ('hanging-straight-leg-raise', 'Elevação de pernas estendidas suspenso', 'Hanging straight-leg raise', 'strength', 'core_flexion',
    array['core'], array['flexores do quadril','antebraços'], 'intermediate',
    array['Pendure-se com os ombros ativos','Eleve as pernas estendidas sem balançar','Desça com controle'],
    'Expire ao elevar e mantenha o abdômen ativo', array['Balançar o corpo','Relaxar os ombros'], true),
  ('hanging-knee-raise', 'Elevação de joelhos suspenso', 'Hanging knee raise', 'strength', 'core_flexion',
    array['core'], array['flexores do quadril','antebraços'], 'intermediate',
    array['Pendure-se com ombros ativos','Eleve os joelhos em direção ao tronco','Desça sem balançar'],
    'Expire ao elevar os joelhos', array['Balançar o corpo','Relaxar os ombros'], true),
  ('knee-push-up', 'Flexão de braços com joelhos apoiados', 'Knee push-up', 'strength', 'horizontal_push',
    array['peitoral'], array['tríceps','ombros','core'], 'beginner',
    array['Apoie mãos e joelhos mantendo o tronco alinhado','Desça o peito com os cotovelos controlados','Empurre o chão sem perder o alinhamento'],
    'Inspire ao descer e expire ao subir', array['Deixar o quadril cair','Abrir excessivamente os cotovelos'], true),
  ('bodyweight-half-squat', 'Meio agachamento com peso corporal', 'Bodyweight half squat', 'strength', 'squat',
    array['quadríceps','glúteos'], array['core'], 'beginner',
    array['Mantenha os pés firmes e os braços à frente','Desça até uma amplitude confortável','Suba mantendo joelhos alinhados'],
    'Expire ao subir', array['Elevar os calcanhares','Joelhos para dentro'], true),
  ('seated-dumbbell-overhead-press', 'Desenvolvimento sentado com halteres', 'Seated dumbbell overhead press', 'strength', 'vertical_push',
    array['ombros'], array['tríceps','core'], 'beginner',
    array['Posicione os halteres na altura dos ombros','Empurre acima da cabeça','Desça com controle'],
    'Expire ao empurrar', array['Arquear a lombar','Bater os halteres no topo'], true),
  ('alternating-superman', 'Superman alternado', 'Alternating superman', 'strength', 'posture',
    array['extensores da coluna'], array['glúteos','estabilizadores escapulares'], 'beginner',
    array['Deite de barriga para baixo','Eleve um braço e a perna oposta em amplitude confortável','Alterne os lados sem forçar o pescoço'],
    'Expire ao elevar cada par', array['Girar o tronco','Hiperestender o pescoço'], true),
  ('bilateral-superman', 'Superman bilateral', 'Bilateral superman', 'strength', 'posture',
    array['extensores da coluna'], array['glúteos','estabilizadores escapulares'], 'beginner',
    array['Deite de barriga para baixo','Eleve os dois braços e as duas pernas em amplitude confortável','Retorne devagar sem forçar o pescoço'],
    'Expire ao elevar', array['Hiperestender o pescoço','Usar amplitude dolorosa'], true),
  ('high-to-low-plank', 'Prancha alta-baixa', 'High-to-low plank', 'strength', 'core_anti_extension',
    array['core'], array['peitoral','ombros','glúteos'], 'beginner',
    array['Comece na prancha alta com as mãos abaixo dos ombros','Desça um antebraço de cada vez mantendo os quadris estáveis','Retorne às mãos sem perder o alinhamento'],
    'Respire continuamente sem perder a tensão', array['Balançar os quadris','Deixar a lombar arquear'], true),
  ('side-plank', 'Prancha lateral', 'Side plank', 'strength', 'core_anti_rotation',
    array['core'], array['glúteos','ombros'], 'beginner',
    array['Apoie o antebraço abaixo do ombro','Eleve o quadril e alinhe o corpo','Mantenha os quadris empilhados'],
    'Respire continuamente mantendo o tronco firme', array['Deixar o quadril cair','Girar o tronco'], true),
  ('standing-toe-raise', 'Elevação da ponta dos pés', 'Standing toe raise', 'strength', 'posture',
    array['tibial anterior'], array['panturrilhas'], 'beginner',
    array['Fique em pé com apoio disponível','Eleve a ponta dos pés mantendo os calcanhares no chão','Retorne com controle'],
    'Respire normalmente', array['Inclinar o tronco','Fazer o movimento com impulso'], true),
  ('back-extension-machine', 'Extensão de tronco na máquina', 'Machine back extension', 'strength', 'posture',
    array['extensores da coluna'], array['glúteos','posteriores de coxa'], 'beginner',
    array['Ajuste o equipamento ao eixo do quadril','Estenda o tronco até a posição neutra','Retorne com controle'],
    'Expire ao estender', array['Hiperestender a lombar','Usar impulso'], true),
  ('burpee', 'Burpee sem salto', 'Burpee', 'cardio', 'cardio',
    array['cardiovascular'], array['pernas','peitoral','core'], 'intermediate',
    array['Agache e apoie as mãos no chão','Leve os pés para trás e retorne','Fique em pé com controle'],
    'Mantenha a respiração ritmada', array['Perder o alinhamento do tronco','Acelerar além do controle'], true),
  ('sumo-deadlift', 'Levantamento terra sumô', 'Sumo deadlift', 'strength', 'hinge',
    array['glúteos','posteriores de coxa'], array['quadríceps','costas','core'], 'intermediate',
    array['Posicione os pés mais afastados e a barra junto ao corpo','Segure a barra entre as pernas','Estenda quadris e joelhos mantendo a coluna neutra'],
    'Trave o tronco antes de subir e expire no topo', array['Joelhos colapsando','Afastar a barra do corpo'], true),
  ('suitcase-carry', 'Caminhada unilateral com kettlebell', 'Kettlebell suitcase carry', 'strength', 'core_anti_rotation',
    array['core'], array['antebraços','trapézio','glúteos'], 'beginner',
    array['Segure um kettlebell ao lado do corpo','Caminhe mantendo ombros e quadris nivelados','Troque o lado ao concluir a distância'],
    'Respire normalmente mantendo o tronco firme', array['Inclinar para o lado da carga','Encolher o ombro'], true),
  ('chair-squat', 'Agachamento com referência de cadeira', 'Chair squat', 'strength', 'squat',
    array['quadríceps','glúteos'], array['core'], 'beginner',
    array['Posicione uma cadeira estável atrás do corpo','Leve o quadril para trás até tocar levemente o assento','Suba mantendo os pés firmes'],
    'Expire ao subir', array['Sentar sem controle','Usar uma cadeira instável'], true),
  ('dumbbell-floor-press', 'Supino no chão com halteres', 'Dumbbell floor press', 'strength', 'horizontal_push',
    array['peitoral'], array['tríceps','deltoide anterior'], 'beginner',
    array['Deite com joelhos flexionados e halteres sobre o peito','Desça até os braços tocarem suavemente o chão','Empurre mantendo os punhos alinhados'],
    'Inspire ao descer e expire ao empurrar', array['Bater os braços no chão','Perder o alinhamento dos punhos'], true),
  ('standing-chest-stretch', 'Alongamento de peitoral em pé', 'Standing chest stretch', 'mobility', 'mobility',
    array['peitoral'], array['ombros'], 'beginner',
    array['Fique em pé com postura alta','Una as mãos atrás do corpo','Afaste suavemente os braços até sentir o alongamento'],
    'Respire de forma lenta e contínua', array['Forçar os ombros','Arquear a lombar'], true),
  ('seated-hamstring-stretch', 'Alongamento de posteriores sentado', 'Seated hamstring stretch', 'mobility', 'mobility',
    array['posteriores de coxa'], array['panturrilhas'], 'beginner',
    array['Sente na borda de uma cadeira estável','Estenda uma perna com o calcanhar apoiado','Incline o tronco a partir do quadril sem arredondar as costas'],
    'Respire de forma lenta e contínua', array['Forçar o joelho','Arredondar excessivamente a coluna'], true)
on conflict(slug) do update set
  name_pt = excluded.name_pt,
  name_en = excluded.name_en,
  category = excluded.category,
  movement_pattern = excluded.movement_pattern,
  primary_muscles = excluded.primary_muscles,
  secondary_muscles = excluded.secondary_muscles,
  difficulty = excluded.difficulty,
  execution_instructions = excluded.execution_instructions,
  breathing_instruction = excluded.breathing_instruction,
  common_errors = excluded.common_errors,
  active = true,
  updated_at = now();

insert into public.exercise_aliases(exercise_id, alias, locale)
select exercise.id, alias.alias, 'en'
from (values
  ('barbell-bench-press', array['barbell bench press','bench press']),
  ('bent-over-barbell-row', array['bent-over barbell row','bent-over row']),
  ('conventional-deadlift', array['conventional deadlift','deadlift']),
  ('pull-up', array['pull-up','pull-ups']),
  ('standing-barbell-press', array['standing barbell press','barbell shoulder press']),
  ('barbell-back-squat', array['barbell back squat','weighted squat']),
  ('incline-barbell-press', array['incline barbell press','incline press']),
  ('hanging-straight-leg-raise', array['hanging straight-leg raise','hanging leg raises']),
  ('hanging-knee-raise', array['hanging knee raise','hanging crunches']),
  ('knee-push-up', array['knee push-up','modified push-up']),
  ('bodyweight-half-squat', array['bodyweight half squat','half squat']),
  ('seated-dumbbell-overhead-press', array['seated dumbbell overhead press','seated dumbbell shoulder press']),
  ('alternating-superman', array['alternating superman','bird dog prone']),
  ('bilateral-superman', array['bilateral superman','superman exercise']),
  ('high-to-low-plank', array['high-to-low plank','plank up-down']),
  ('side-plank', array['side plank']),
  ('standing-toe-raise', array['standing toe raise','toe lift']),
  ('back-extension-machine', array['machine back extension','back extension machine']),
  ('burpee', array['burpee']),
  ('sumo-deadlift', array['sumo deadlift']),
  ('suitcase-carry', array['kettlebell suitcase carry','one-sided farmer walk']),
  ('chair-squat', array['chair squat','chair target squat']),
  ('dumbbell-floor-press', array['dumbbell floor press','floor press']),
  ('standing-chest-stretch', array['standing chest stretch']),
  ('seated-hamstring-stretch', array['seated hamstring stretch'])
) as alias_group(slug, aliases)
join public.exercises exercise on exercise.slug = alias_group.slug
cross join lateral unnest(alias_group.aliases) alias(alias)
on conflict(exercise_id, alias) do nothing;

with requirements(slug, equipment_slugs) as (values
  ('barbell-bench-press', array['barbell','bench']),
  ('bent-over-barbell-row', array['barbell']),
  ('conventional-deadlift', array['barbell']),
  ('pull-up', array['pull-up-bar']),
  ('standing-barbell-press', array['barbell']),
  ('barbell-back-squat', array['barbell']),
  ('incline-barbell-press', array['barbell','bench']),
  ('hanging-straight-leg-raise', array['pull-up-bar']),
  ('hanging-knee-raise', array['pull-up-bar']),
  ('knee-push-up', array['bodyweight']),
  ('bodyweight-half-squat', array['bodyweight']),
  ('seated-dumbbell-overhead-press', array['dumbbells','bench']),
  ('alternating-superman', array['bodyweight']),
  ('bilateral-superman', array['bodyweight']),
  ('high-to-low-plank', array['bodyweight']),
  ('side-plank', array['bodyweight']),
  ('standing-toe-raise', array['bodyweight']),
  ('back-extension-machine', array['back-extension-machine']),
  ('burpee', array['bodyweight']),
  ('sumo-deadlift', array['barbell']),
  ('suitcase-carry', array['kettlebell']),
  ('chair-squat', array['bodyweight']),
  ('dumbbell-floor-press', array['dumbbells']),
  ('standing-chest-stretch', array['bodyweight']),
  ('seated-hamstring-stretch', array['bodyweight'])
)
insert into public.exercise_equipment(exercise_id, equipment_id, required)
select exercise.id, equipment.id, true
from requirements
join public.exercises exercise on exercise.slug = requirements.slug
cross join lateral unnest(requirements.equipment_slugs) required_equipment(slug)
join public.equipment equipment on equipment.slug = required_equipment.slug
on conflict(exercise_id, equipment_id) do update set required = true;

with substitution_groups(group_name, slugs) as (values
  ('squat', array['leg-press','goblet-squat','barbell-back-squat','bodyweight-half-squat','chair-squat']),
  ('hinge', array['conventional-deadlift','sumo-deadlift','hip-thrust']),
  ('horizontal-push', array['machine-chest-press','barbell-bench-press','incline-barbell-press','dumbbell-floor-press','knee-push-up']),
  ('horizontal-pull', array['machine-row','seated-row','bent-over-barbell-row']),
  ('vertical-push', array['machine-shoulder-press','standing-barbell-press','seated-dumbbell-overhead-press']),
  ('vertical-pull', array['lat-pulldown','neutral-pulldown','supinated-pulldown','pull-up']),
  ('core', array['plank','high-to-low-plank','side-plank','dead-bug','hanging-straight-leg-raise','hanging-knee-raise','suitcase-carry']),
  ('posture', array['wall-slide','face-pull','reverse-fly','alternating-superman','bilateral-superman','back-extension-machine','standing-toe-raise']),
  ('mobility', array['thoracic-extension','standing-chest-stretch','seated-hamstring-stretch']),
  ('cardio', array['walking','treadmill','incline-treadmill','bike','elliptical','burpee'])
), pairs as (
  select source_slug, alternative_slug
  from substitution_groups
  cross join lateral unnest(slugs) source(source_slug)
  cross join lateral unnest(slugs) alternative(alternative_slug)
  where source_slug <> alternative_slug
)
insert into public.exercise_substitutions(
  exercise_id, alternative_exercise_id, score, reason,
  same_movement_pattern, same_primary_muscle
)
select source.id, alternative.id, 80,
  'Alternativa funcional da biblioteca v2.1',
  source.movement_pattern = alternative.movement_pattern,
  source.primary_muscles && alternative.primary_muscles
from pairs
join public.exercises source on source.slug = pairs.source_slug
join public.exercises alternative on alternative.slug = pairs.alternative_slug
on conflict(exercise_id, alternative_exercise_id) do nothing;

commit;
