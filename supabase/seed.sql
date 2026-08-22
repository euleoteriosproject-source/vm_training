insert into public.allowed_signup_emails(email,display_name,default_role) values
('vinicius.euleoterio@hotmail.com','Vinicius','admin'),
('lisepaiva@hotmail.com','Marlise','member'),
('v172-mobile@example.test','VM Training E2E mobile','member'),
('v172-desktop@example.test','VM Training E2E desktop','member')
on conflict(email) do update set display_name=excluded.display_name, default_role=excluded.default_role, active=true;

insert into public.equipment(slug,name) values
('treadmill','Esteira'),('bike','Bicicleta'),('elliptical','Elíptico'),('leg-press','Leg press'),('hack-squat','Hack squat'),
('smith','Smith'),('leg-extension','Cadeira extensora'),('lying-leg-curl','Mesa flexora'),('seated-leg-curl','Cadeira flexora'),
('abductor','Máquina abdutora'),('adductor','Máquina adutora'),('cable','Polia / cross over'),('row-machine','Remada articulada'),
('lat-pulldown','Puxada'),('chest-press','Supino máquina'),('dumbbells','Halteres'),('barbell','Barra e anilhas'),('bench','Banco'),
('kettlebell','Kettlebell'),('band','Faixa elástica'),('bodyweight','Peso corporal') on conflict(slug) do nothing;

insert into public.exercises(slug,name_pt,category,movement_pattern,primary_muscles,secondary_muscles,difficulty,execution_instructions,breathing_instruction,common_errors,active) values
('leg-press','Leg press','strength','squat',array['quadríceps','glúteos'],array['posteriores'], 'beginner',array['Apoie toda a coluna','Desça com controle','Empurre pela planta dos pés'],'Expire ao empurrar',array['Tirar o quadril do banco','Travar os joelhos'],false),
('hack-squat','Hack squat','strength','squat',array['quadríceps','glúteos'],array['posteriores'],'intermediate',array['Apoie costas e ombros','Desça até amplitude confortável','Suba sem travar joelhos'],'Expire ao subir',array['Joelhos colapsando','Perder apoio do calcanhar'],false),
('smith-squat','Agachamento smith','strength','squat',array['quadríceps','glúteos'],array['core'],'intermediate',array['Posicione os pés à frente','Desça com controle','Mantenha tronco firme'],'Expire ao subir',array['Descer além do controle','Joelhos para dentro'],false),
('goblet-squat','Goblet squat','strength','squat',array['quadríceps','glúteos'],array['core'],'beginner',array['Segure o halter junto ao peito','Agache entre os quadris','Suba empurrando o chão'],'Expire ao subir',array['Curvar as costas','Elevar os calcanhares'],false),
('leg-extension','Cadeira extensora','strength','knee_extension',array['quadríceps'],array[]::text[],'beginner',array['Alinhe o joelho ao eixo','Estenda com controle','Retorne sem soltar o peso'],'Expire ao estender',array['Usar impulso','Tirar o quadril do assento'],false),
('lying-leg-curl','Mesa flexora','strength','knee_flexion',array['posteriores de coxa'],array['panturrilhas'],'beginner',array['Alinhe joelhos ao eixo','Flexione sem elevar o quadril','Retorne devagar'],'Expire ao flexionar',array['Arquear a lombar','Usar impulso'],false),
('seated-leg-curl','Cadeira flexora','strength','knee_flexion',array['posteriores de coxa'],array['panturrilhas'],'beginner',array['Ajuste o encosto','Flexione até amplitude confortável','Controle a volta'],'Expire ao flexionar',array['Levantar o quadril','Soltar a volta'],false),
('hip-thrust','Hip thrust','strength','hip_extension',array['glúteos'],array['posteriores','core'],'intermediate',array['Apoie escápulas','Eleve o quadril','Contraia glúteos sem hiperestender'],'Expire no topo',array['Hiperestender lombar','Empurrar pelos dedos'],false),
('machine-glute','Glúteo máquina','strength','hip_extension',array['glúteos'],array['posteriores'],'beginner',array['Estabilize o tronco','Estenda o quadril','Retorne controlando'],'Expire ao estender',array['Girar o quadril','Usar impulso'],false),
('calf-raise','Panturrilha','strength','knee_extension',array['panturrilhas'],array[]::text[],'beginner',array['Desça o calcanhar','Suba até a ponta dos pés','Pause no topo'],'Expire ao subir',array['Quicar','Amplitude curta'],false),
('lat-pulldown','Puxada frontal','strength','vertical_pull',array['latíssimo do dorso'],array['bíceps'],'beginner',array['Deprima as escápulas','Puxe ao alto do peito','Retorne com controle'],'Expire ao puxar',array['Puxar atrás da nuca','Balançar o tronco'],false),
('neutral-pulldown','Puxada neutra','strength','vertical_pull',array['latíssimo do dorso'],array['bíceps'],'beginner',array['Mantenha o peito alto','Puxe os cotovelos para baixo','Alongue com controle'],'Expire ao puxar',array['Encolher ombros','Usar impulso'],false),
('supinated-pulldown','Puxada supinada','strength','vertical_pull',array['latíssimo do dorso'],array['bíceps'],'intermediate',array['Segure com palmas para você','Puxe ao peito','Controle a subida'],'Expire ao puxar',array['Abrir os cotovelos','Balançar'],false),
('seated-row','Remada baixa','strength','horizontal_pull',array['costas'],array['bíceps','deltoide posterior'],'beginner',array['Sente com coluna neutra','Puxe cotovelos para trás','Retorne sem arredondar'],'Expire ao puxar',array['Encolher ombros','Balançar o tronco'],false),
('machine-row','Remada articulada','strength','horizontal_pull',array['costas'],array['bíceps'],'beginner',array['Apoie o peito','Puxe pelas costas','Retorne controlando'],'Expire ao puxar',array['Projetar a cabeça','Encolher ombros'],false),
('one-arm-row','Remada unilateral','strength','horizontal_pull',array['costas'],array['bíceps','core'],'intermediate',array['Apoie mão e joelho','Puxe ao quadril','Mantenha tronco estável'],'Expire ao puxar',array['Girar o tronco','Puxar ao ombro'],false),
('reverse-fly','Reverse fly','strength','posture',array['deltoide posterior'],array['trapézio médio'],'beginner',array['Mantenha peito apoiado','Abra os braços','Controle o retorno'],'Expire ao abrir',array['Encolher ombros','Carga excessiva'],false),
('face-pull','Face pull','strength','posture',array['deltoide posterior','trapézio'],array['rotadores externos'],'intermediate',array['Puxe a corda ao rosto','Abra as mãos','Retorne controlando'],'Expire ao puxar',array['Arquear lombar','Cotovelos baixos'],false),
('machine-chest-press','Supino máquina','strength','horizontal_push',array['peitoral'],array['tríceps','deltoide anterior'],'beginner',array['Apoie as costas','Empurre sem travar cotovelos','Retorne controlando'],'Expire ao empurrar',array['Elevar ombros','Perder apoio'],false),
('incline-machine-press','Supino inclinado máquina','strength','horizontal_push',array['peitoral superior'],array['tríceps','ombros'],'beginner',array['Ajuste o banco','Empurre para cima e à frente','Controle a volta'],'Expire ao empurrar',array['Arquear excessivamente','Encolher ombros'],false),
('machine-fly','Crucifixo máquina','strength','horizontal_push',array['peitoral'],array['deltoide anterior'],'beginner',array['Apoie as costas','Una os braços','Retorne até alongamento confortável'],'Expire ao fechar',array['Bater os pesos','Alongar demais'],false),
('machine-shoulder-press','Desenvolvimento máquina','strength','vertical_push',array['ombros'],array['tríceps'],'beginner',array['Apoie as costas','Empurre acima da cabeça','Controle a descida'],'Expire ao empurrar',array['Arquear lombar','Encolher ombros'],false),
('lateral-raise','Elevação lateral','strength','vertical_push',array['deltoide lateral'],array['trapézio'],'beginner',array['Mantenha cotovelos suaves','Eleve até a linha dos ombros','Desça devagar'],'Expire ao elevar',array['Usar impulso','Elevar acima do controle'],false),
('dead-bug','Dead bug','strength','core_anti_extension',array['core'],array['flexores do quadril'],'beginner',array['Cole a lombar no chão','Estenda membros opostos','Retorne sem perder pressão'],'Expire ao estender',array['Arquear a lombar','Prender a respiração'],false),
('plank','Prancha','strength','core_anti_extension',array['core'],array['glúteos','ombros'],'beginner',array['Alinhe ombros e quadris','Contraia abdômen e glúteos','Respire normalmente'],'Respire de forma contínua',array['Quadril caído','Prender a respiração'],false),
('pallof-press','Pallof press','strength','core_anti_rotation',array['core'],array['ombros'],'beginner',array['Fique de lado para a polia','Estenda os braços','Resista à rotação'],'Expire ao estender',array['Girar o tronco','Perder postura'],false),
('farmer-walk','Farmer walk','strength','carry',array['core','antebraços'],array['trapézio','glúteos'],'beginner',array['Segure pesos ao lado','Caminhe com postura alta','Dê passos controlados'],'Respire normalmente',array['Inclinar para um lado','Passos apressados'],false),
('wall-slide','Wall slide','mobility','posture',array['estabilizadores escapulares'],array['ombros'],'beginner',array['Apoie costas na parede','Deslize os braços para cima','Mantenha costelas baixas'],'Expire ao subir',array['Arquear lombar','Forçar amplitude'],false),
('chin-tuck','Chin tuck','mobility','posture',array['flexores cervicais'],array[]::text[],'beginner',array['Olhe à frente','Recolha suavemente o queixo','Relaxe e repita'],'Respire normalmente',array['Olhar para baixo','Aplicar força excessiva'],false),
('thoracic-extension','Extensão torácica','mobility','mobility',array['coluna torácica'],array['peitoral'],'beginner',array['Apoie a parte alta das costas','Estenda sobre o apoio','Evite compensar na lombar'],'Expire ao estender',array['Forçar o pescoço','Hiperestender lombar'],false),
('treadmill','Esteira','cardio','cardio',array['cardiovascular'],array['pernas'],'beginner',array['Comece em ritmo leve','Mantenha postura alta','Reduza antes de parar'],'Respire ritmadamente',array['Segurar nas barras','Aumentar rápido demais'],false),
('incline-treadmill','Esteira inclinada','cardio','cardio',array['cardiovascular'],array['glúteos','panturrilhas'],'beginner',array['Aumente a inclinação gradualmente','Dê passos naturais','Mantenha tronco alto'],'Respire ritmadamente',array['Apoiar peso nas mãos','Inclinação excessiva'],false),
('bike','Bicicleta','cardio','cardio',array['cardiovascular'],array['quadríceps'],'beginner',array['Ajuste a altura do banco','Pedale de forma estável','Mantenha joelhos alinhados'],'Respire ritmadamente',array['Banco baixo','Resistência excessiva'],false),
('elliptical','Elíptico','cardio','cardio',array['cardiovascular'],array['pernas','braços'],'beginner',array['Apoie os pés','Movimente de forma fluida','Mantenha tronco alto'],'Respire ritmadamente',array['Curvar o tronco','Passadas bruscas'],false),
('walking','Caminhada','cardio','cardio',array['cardiovascular'],array['pernas'],'beginner',array['Caminhe em ritmo confortável','Balance os braços','Mantenha postura natural'],'Respire ritmadamente',array['Passadas longas demais','Ignorar dor'],false)
on conflict(slug) do nothing;

insert into public.exercise_aliases(exercise_id,alias,locale)
select id, alias, 'en' from public.exercises cross join lateral unnest(case slug
  when 'leg-press' then array['seated leg press','leg press machine','machine leg press']
  when 'hack-squat' then array['hack squat','hack squat machine','machine hack squat']
  when 'smith-squat' then array['smith squat','smith machine squat','smith machine back squat']
  when 'goblet-squat' then array['goblet squat','kettlebell goblet squat','dumbbell goblet squat']
  when 'leg-extension' then array['leg extension','leg extension machine','knee extension','seated leg extension']
  when 'lying-leg-curl' then array['leg curl','lying leg curl','prone leg curl','hamstring curl','lying hamstring curl']
  when 'seated-leg-curl' then array['seated leg curl','seated hamstring curl','leg curl machine']
  when 'hip-thrust' then array['hip thrust','barbell hip thrust','weighted hip thrust','bench hip thrust','glute hip thrust']
  when 'machine-glute' then array['glute kickback machine','machine glute kickback','hip extension machine']
  when 'calf-raise' then array['standing calf raise','calf raise','calf raise machine']
  when 'lat-pulldown' then array['lat pulldown','lat pull down','front lat pulldown','cable pulldown','pulldown machine','wide grip pulldown']
  when 'neutral-pulldown' then array['neutral grip lat pulldown','neutral pulldown','close grip pulldown']
  when 'supinated-pulldown' then array['reverse grip lat pulldown','supinated pulldown','underhand pulldown']
  when 'seated-row' then array['seated row','seated cable row','low row','cable row','low cable row']
  when 'machine-row' then array['row machine','seated row machine','machine row','chest supported row machine']
  when 'one-arm-row' then array['one arm dumbbell row','single arm dumbbell row','one arm row']
  when 'reverse-fly' then array['reverse fly','reverse fly machine','rear delt fly','rear delt machine','reverse pec deck']
  when 'face-pull' then array['face pull','cable face pull','rope face pull','rear delt rope pull','cable rear delt pull']
  when 'machine-chest-press' then array['machine chest press','chest press machine','seated chest press','chest press exercise']
  when 'incline-machine-press' then array['incline chest press machine','incline machine press','incline press machine']
  when 'machine-fly' then array['pec deck','pec deck fly','machine chest fly','chest fly machine']
  when 'machine-shoulder-press' then array['shoulder press','machine shoulder press','seated shoulder press','overhead press machine','shoulder press exercise']
  when 'lateral-raise' then array['dumbbell lateral raise','lateral raise','side lateral raise']
  when 'dead-bug' then array['dead bug','dead bug exercise','core dead bug']
  when 'plank' then array['forearm plank','plank exercise','abdominal plank']
  when 'pallof-press' then array['pallof press','cable pallof press','anti rotation press','anti-rotation press']
  when 'farmer-walk' then array['farmer walk','farmers walk','farmer carry','loaded carry','kettlebell farmer walk']
  when 'wall-slide' then array['wall slide','wall slides exercise','wall angel','wall shoulder slide']
  when 'chin-tuck' then array['chin tuck','cervical retraction','neck retraction exercise']
  when 'thoracic-extension' then array['thoracic extension','thoracic spine extension','foam roller thoracic extension']
  when 'treadmill' then array['treadmill walking','walking on treadmill','treadmill exercise']
  when 'incline-treadmill' then array['incline treadmill walking','incline walking','treadmill incline exercise']
  when 'bike' then array['stationary bicycle','exercise bike','stationary bike exercise']
  when 'elliptical' then array['elliptical trainer','cross trainer','elliptical exercise']
  when 'walking' then array['brisk walking','walking exercise','fitness walking']
  else array[name_pt] end) alias
on conflict(exercise_id,alias) do nothing;

insert into public.exercise_equipment(exercise_id,equipment_id)
select e.id,q.id from public.exercises e join public.equipment q on q.slug = case e.slug
when 'leg-press' then 'leg-press' when 'hack-squat' then 'hack-squat' when 'smith-squat' then 'smith'
when 'goblet-squat' then 'dumbbells' when 'leg-extension' then 'leg-extension' when 'lying-leg-curl' then 'lying-leg-curl'
when 'seated-leg-curl' then 'seated-leg-curl' when 'hip-thrust' then 'barbell' when 'machine-glute' then 'abductor'
when 'calf-raise' then 'bodyweight' when 'lat-pulldown' then 'lat-pulldown' when 'neutral-pulldown' then 'lat-pulldown'
when 'supinated-pulldown' then 'lat-pulldown' when 'seated-row' then 'cable' when 'machine-row' then 'row-machine'
when 'one-arm-row' then 'dumbbells' when 'reverse-fly' then 'chest-press' when 'face-pull' then 'cable'
when 'machine-chest-press' then 'chest-press' when 'incline-machine-press' then 'chest-press' when 'machine-fly' then 'chest-press'
when 'machine-shoulder-press' then 'chest-press' when 'lateral-raise' then 'dumbbells' when 'pallof-press' then 'cable'
when 'farmer-walk' then 'dumbbells' when 'treadmill' then 'treadmill' when 'incline-treadmill' then 'treadmill'
when 'bike' then 'bike' when 'elliptical' then 'elliptical' else 'bodyweight' end
on conflict do nothing;

-- Candidatos reais verificados no Wikimedia Commons. Permanecem pendentes até
-- revisão humana da execução e processamento server-side com FFmpeg.
insert into public.exercise_media(
  exercise_id,media_type,storage_path,angle,status,source_name,source_type,source_url,
  license_code,license_url,author,attribution_text,attribution_required,original_file_url,
  file_size_bytes,width,height,match_score,match_details,candidate_metadata
)
select exercise.id,'video',null,'main','pending','Wikimedia Commons','public_domain',candidate.source_url,
  'PD','https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Public_domain','Centers for Disease Control and Prevention',candidate.attribution,false,candidate.original_file_url,
  candidate.file_size,candidate.width,candidate.height,candidate.match_score,candidate.match_details,candidate.metadata
from (
  values
    ('leg-press',
     'https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Seated_Leg_Press.webm',
     'https://upload.wikimedia.org/wikipedia/commons/8/83/Muscle_Strengthening_at_the_Gym_-_Seated_Leg_Press.webm',
     6632747::bigint,320,240,70,
     '{"exactName":true,"exactAlias":false,"equipment":true,"movementPattern":false,"muscle":false}'::jsonb,
     '{"title":"Muscle Strengthening at the Gym - Seated Leg Press.webm","licenseVerifiedAt":"2026-08-19","publisher":"Centers for Disease Control and Prevention"}'::jsonb,
     '“Muscle Strengthening at the Gym - Seated Leg Press.webm”. Fonte: Wikimedia Commons. Licença: Public Domain.'),
    ('machine-chest-press',
     'https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm',
     'https://upload.wikimedia.org/wikipedia/commons/7/70/Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm',
     3562923::bigint,320,240,90,
     '{"exactName":false,"exactAlias":true,"equipment":true,"movementPattern":true,"muscle":true}'::jsonb,
     '{"title":"Muscle Strengthening at the Gym - Chest Press.webm","licenseVerifiedAt":"2026-08-19","publisher":"Centers for Disease Control and Prevention"}'::jsonb,
     '“Muscle Strengthening at the Gym - Chest Press.webm”. Fonte: Wikimedia Commons. Licença: Public Domain.'),
    ('machine-row',
     'https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Row_Machine.webm',
     'https://upload.wikimedia.org/wikipedia/commons/5/50/Muscle_Strengthening_at_the_Gym_-_Row_Machine.webm',
     3383080::bigint,320,240,90,
     '{"exactName":false,"exactAlias":true,"equipment":true,"movementPattern":true,"muscle":true}'::jsonb,
     '{"title":"Muscle Strengthening at the Gym - Row Machine.webm","licenseVerifiedAt":"2026-08-19","publisher":"Centers for Disease Control and Prevention"}'::jsonb,
     '“Muscle Strengthening at the Gym - Row Machine.webm”. Fonte: Wikimedia Commons. Licença: Public Domain.')
) as candidate(slug,source_url,original_file_url,file_size,width,height,match_score,match_details,metadata,attribution)
join public.exercises exercise on exercise.slug=candidate.slug
on conflict(exercise_id,source_url) do nothing;

insert into public.exercise_substitutions(exercise_id,alternative_exercise_id,score,reason,same_movement_pattern,same_primary_muscle)
select a.id,b.id,90,'Mesmo padrão de movimento e grupo muscular',true,true from public.exercises a join public.exercises b on
(a.slug,b.slug) in (('lat-pulldown','neutral-pulldown'),('neutral-pulldown','lat-pulldown'),('lat-pulldown','supinated-pulldown'),('supinated-pulldown','lat-pulldown'),('seated-row','machine-row'),('machine-row','seated-row'),('seated-row','one-arm-row'),('one-arm-row','seated-row'),('leg-press','hack-squat'),('hack-squat','leg-press'),('leg-press','smith-squat'),('smith-squat','leg-press'),('lying-leg-curl','seated-leg-curl'),('seated-leg-curl','lying-leg-curl'),('machine-chest-press','incline-machine-press'),('incline-machine-press','machine-chest-press'))
on conflict do nothing;
