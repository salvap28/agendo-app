CONTEXTO TECNICO TOTAL DE AGENDO PARA INTEGRACION CON OTRA IA
Fecha de relevamiento: 2026-04-30
Repo local: c:\Users\salva\Documents\AGENDO\agendo-app

===============================================================================
1. PROPOSITO DE ESTE DOCUMENTO
===============================================================================

Este archivo esta escrito para que otra IA pueda incorporarse al trabajo sobre
Agendo con una vision tecnica completa: stack, rutas, modulos, datos, flujos,
riesgos, contratos internos y lugares correctos para extender la app.

Agendo no es solo un calendario. La app combina:

- Calendario personal con bloques de tiempo.
- Sesiones de foco y rutinas de entrada/salida.
- Captura de intenciones/habitos desde lenguaje natural.
- Planner inteligente que propone bloques a partir de texto.
- Recomendaciones adaptativas basadas en comportamiento historico.
- Registro de experiencias de actividad, incluyendo actividades que no son foco.
- Analitica personal y perfil de comportamiento.
- Notificaciones web push y recordatorios programados.
- Configuracion de usuario, idioma, apariencia y preferencias.

La regla mas importante para cualquier IA que modifique este repo:

Usar los contratos existentes. La mayoria de la logica de dominio ya esta
separada en motores puros, servicios cliente, modulos server y stores Zustand.
Evitar meter reglas nuevas directamente dentro de componentes si ya existe un
engine/server/service apropiado.

===============================================================================
2. ESTADO ACTUAL DEL WORKSPACE
===============================================================================

El repo esta en desarrollo activo y hay cambios sin commitear. No asumir que
todo lo que aparece en archivos modificados ya esta en produccion estable.

Archivos modificados detectados:

- app/api/notifications/send/route.ts
- app/api/notifications/test-ping/route.ts
- components/home/HabitContext.tsx
- lib/server/habit.ts
- lib/server/planning.ts
- lib/services/planningService.ts
- lib/types/habit.ts
- lib/utils/notifications.ts
- supabase/functions/send-block-reminders/index.ts
- supabase/schema.sql

Archivos/carpetas nuevos no trackeados detectados:

- .claude/settings.local.json
- app/api/planning/planner/
- components/habit/HabitCaptureCard.tsx
- components/habit/HabitPlanningProposalSheet.tsx
- lib/engines/habit/capture.test.ts
- lib/engines/habit/capture.ts
- lib/engines/planner/
- lib/server/planner.ts
- lib/server/plannerPersistence.ts
- lib/server/pushNotifications.ts
- lib/types/planner.ts
- supabase/migrations/20260413010000_planner_persistence_v1.sql

Nota de calidad/encoding:

En varios archivos se ven cadenas con mojibake, por ejemplo caracteres como
"Â¡", "maÃ±ana" o bytes de emoji mal renderizados. Antes de tocar textos UI o
copiar strings existentes, verificar encoding. Este documento se mantiene en
ASCII intencionalmente para evitar sumar ruido.

===============================================================================
3. STACK Y COMANDOS
===============================================================================

Stack principal:

- Next.js 16.1.7 con App Router.
- React 19.2.3.
- TypeScript estricto.
- Tailwind CSS v4.
- Supabase Auth, DB, SSR helpers y Edge Functions.
- Zustand para estado cliente.
- Radix UI / shadcn-style primitives para UI.
- date-fns para fechas.
- lucide-react para iconos.
- motion / framer-motion para animaciones.
- Three.js, @react-three/fiber y drei para escenas/efectos 3D.
- web-push para notificaciones push desde Node.
- @dnd-kit para drag and drop.
- Vitest + jsdom + Testing Library para tests.

Versiones recomendadas segun README:

- Node 24.11.0
- npm 11.6.1

Scripts en package.json:

- npm run dev      -> next dev
- npm run build    -> next build
- npm run start    -> next start
- npm run lint     -> eslint
- npm run test     -> vitest run

Alias TypeScript:

- @/* apunta a la raiz del repo.

Variables de entorno relevantes:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_VAPID_PUBLIC_KEY
- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_APP_URL
- NEXT_PUBLIC_SITE_URL
- APP_BASE_URL
- PERSONAL_INTELLIGENCE_CRON_SECRET

Notas:

- Las funciones de Supabase se excluyen del tsconfig principal.
- No usar service role client en componentes cliente.
- Las rutas server usan cookies de Supabase SSR para auth.

===============================================================================
4. MAPA DE DIRECTORIOS
===============================================================================

app/
  App Router de Next. Contiene paginas, layouts y API routes.

components/
  UI y superficies de producto:
  - home: home, calendario, habit context, intro, menu.
  - focus: overlay/sesion de foco, tarjetas, rituales, gym panel.
  - calendar: vistas de calendario y editor radial de bloques.
  - habit: captura de habito/planner y sheets relacionados.
  - insights: dashboard de inteligencia personal.
  - settings: pantallas de configuracion.
  - ui: primitives compartidos.

hooks/
  Hooks cliente de runtime: sync remoto de foco, timers, performance, etc.

lib/
  Core de la app:
  - engines: logica pura de dominio.
  - server: consultas Supabase y orquestacion server-side.
  - services: wrappers cliente/server hacia API routes.
  - stores: Zustand stores.
  - supabase: clientes browser/server/admin/middleware.
  - types: contratos TypeScript principales.
  - utils: helpers de notificaciones, idioma, fechas, block state, etc.

public/
  Assets publicos y service worker.

supabase/
  Migraciones, schema consolidado, funciones Edge y config local.

scripts sueltos en raiz:
  Hay scripts como replaceWeekView.js, replaceBlockItem.js, etc. Parecen
  herramientas ad hoc de mantenimiento/refactor. No tratarlos como runtime
  central salvo que el usuario lo pida.

===============================================================================
5. ARQUITECTURA DE ALTO NIVEL
===============================================================================

La app usa separacion por capas:

UI Components
  Renderizan, manejan interaccion, muestran sheets/modals, llaman stores o
  services. Deben contener poca logica de dominio pesada.

Zustand Stores
  Manejan estado cliente y operaciones optimistas:
  - blocksStore
  - focusStore
  - settingsStore
  - gymStore
  - activityExperienceStore

Services
  Wrappers de fetch hacia API routes o Supabase. Ejemplos:
  - habitService
  - planningService
  - focusService
  - activityExperienceService

API Routes
  Entrada HTTP para cliente y jobs. Validan auth, parsean payloads y llaman
  modulos server.

Server Modules
  Orquestan Supabase, persistencia y engines. Ejemplos:
  - lib/server/habit.ts
  - lib/server/planning.ts
  - lib/server/planner.ts
  - lib/server/personalIntelligence.ts
  - lib/server/activityExperience.ts

Engines
  Logica pura/testeable, sin depender directamente de UI:
  - focus engine
  - planning engine
  - planner heuristic
  - habit selectors
  - activity experience analytics
  - personal intelligence engine

Supabase
  Persistencia, Auth, RLS, realtime y Edge Functions.

===============================================================================
6. AUTENTICACION Y SESION
===============================================================================

Archivos clave:

- lib/supabase/config.ts
- lib/supabase/client.ts
- lib/supabase/server.ts
- lib/supabase/admin.ts
- lib/supabase/middleware.ts
- proxy.ts
- app/login/page.tsx
- app/login/actions.ts
- app/auth/callback/route.ts

Flujo:

1. Usuario visita app.
2. proxy.ts ejecuta middleware Supabase.
3. Si no hay usuario y la ruta no es publica, redirige a /login.
4. /login usa server actions:
   - login(formData)
   - signup(formData)
   - logout()
5. Signup guarda username en metadata y usa email redirect hacia
   /auth/callback.
6. /auth/callback intercambia code por session y redirige.

Login soporta email o username:

- Si el identificador no contiene "@", intenta resolver email con RPC
  get_email_by_username.

Rutas publicas/exceptuadas importantes:

- /login
- /auth/*
- service worker, manifest, favicon, iconos
- /api/analytics/consolidate/batch, protegida por secreto interno, no por sesion

Notas para otra IA:

- No duplicar auth manualmente en componentes. Usar createClient/server client.
- En API routes, primero obtener user con supabase.auth.getUser().
- Si se necesita service role, usar lib/supabase/admin.ts solo en server.

===============================================================================
7. IDIOMA, SETTINGS Y PREFERENCIAS
===============================================================================

Archivos clave:

- lib/stores/settingsStore.ts
- lib/utils/language.ts
- app/layout.tsx
- components/LanguageSync.tsx
- app/settings/*

Settings se persisten en:

- localStorage, key agendo-settings.
- Tabla user_settings en Supabase.
- Cookie/html lang para idioma.

Preferencias principales:

- language: en/es.
- theme/performance mode.
- firstDayOfWeek.
- time format 12h/24h.
- focusDuration.
- restDuration.
- autoStartRest.
- pomodoro custom focus/rest.
- notification toggles:
  - blockReminders
  - focusTimer
  - gymRest
  - dailyBriefing

El store tolera columnas faltantes/caches de esquema. Esto sugiere que el
schema puede haber evolucionado y se preserva compatibilidad hacia atras.

===============================================================================
8. HOME Y SUPERFICIES PRINCIPALES
===============================================================================

app/layout.tsx:

- Define HTML lang desde getServerLanguage.
- Fuerza clase dark.
- Incluye LanguageSync.
- Incluye FocusOverlay global.

app/page.tsx:

- Home principal cliente.
- Usa layout full-screen snap scrolling.
- Secciones actuales:
  - SectionIntro
  - HabitContext
  - SectionCalendar
  - UserMenu
  - BackgroundEclipse si el dispositivo/performance lo permite.
- Carga bloques con useBlocksStore.
- Sincroniza estados efectivos de bloques cada 30 segundos.

components/home/SectionIntro.tsx:

- Hero minimal "Agendo" y flecha para avanzar.

components/home/HabitContext.tsx:

- Es la superficie central de habito/planner/contexto.
- Carga /api/habit/home usando fetchHabitHome.
- Maneja deep links/query params:
  - habit
  - blockId
  - notification
  - source=widget
- Registra eventos de habito:
  - home viewed
  - planner entry seen
  - daily summary seen
  - weekly consistency seen
  - next block seen
  - adaptive recommendation shown
  - planner proposal seen/applied/etc.
- Muestra captura de habito/planner.
- Muestra ritual diario, consistencia semanal, rescue plan, siguiente bloque.
- Programa notificaciones locales/browser para siguiente bloque y rescue, con
  guards en localStorage.
- Integra sheets:
  - HabitCaptureCard
  - HabitActivationSheet
  - HabitPlanningProposalSheet
  - GuidedPlanningSheet
  - RadialBlockMenu

Acciones relevantes en HabitContext:

- startNext:
  - Si hay sesion pausada, vuelve al foco.
  - Si hay nextBlock, abre FocusOverlay desde el bloque.
  - Si no hay nextBlock, crea bloque protegido con metadata de planning.
  - Si no puede crear bloque, abre foco libre.
- requestPlannerProposal:
  - Llama /api/planning/planner/propose.
  - Abre HabitPlanningProposalSheet.
- applyPlannerProposalRequest:
  - Llama /api/planning/planner/apply.
  - Refresca bloques.
- revise:
  - Llama /api/planning/planner/decision con lighten/regenerate/edit/reject.
- Rescue:
  - Puede actualizar bloque, cancelar, registrar reschedule activity y loguear
    eventos de rescate.

components/home/SectionCalendar.tsx:

- Vista calendario en home.
- Mobile: DailyAgendaView + FAB.
- Desktop: GlassCalendarDashboard.
- Usa createBlock y RadialBlockMenu.
- Bloques nuevos se enriquecen con metadata de planning.
- Bloque mobile por defecto: 60 minutos, desde ahora o 9:00 del dia elegido.

components/home/SectionContext.tsx:

- Parece una superficie alternativa/legacy de contexto rico.
- Incluye summary, notificaciones, quick checkout, planning recs, guided
  planning y dock.
- No parece estar montada actualmente desde app/page.tsx.

components/home/UserMenu.tsx:

- Dropdown de usuario.
- Links a Insights, Settings y logout.

app/widget/page.tsx:

- Widget server-side compacto.
- Requiere auth.
- Usa getHabitHomeData.
- Renderiza WidgetViewTracker y CTA con deep link hacia home.

app/insights/page.tsx:

- Server page protegida.
- Llama getInsightsDashboardData.
- Renderiza InsightsDashboard.

===============================================================================
9. CALENDARIO Y BLOQUES
===============================================================================

Tipo central:

- lib/types/blocks.ts

BlockType:

- deep_work
- study
- gym
- meeting
- admin
- break
- other

BlockStatus:

- planned
- active
- completed
- canceled

Campos importantes de Block:

- id
- userId
- title
- type
- status
- startAt
- endAt
- notes
- tag
- color
- metadata de planning:
  - priority
  - estimatedDurationMinutes
  - difficulty
  - flexibility
  - intensity
  - deadline
  - cognitivelyHeavy
  - splittable
  - optional
- recurrence
- notifications
- metadata de activity experience:
  - engagementMode
  - requiresFocusMode
  - generatesExperienceRecord
  - socialDemandHint
  - locationMode
  - presenceMode

Store:

- lib/stores/blocksStore.ts

Responsabilidades del blocksStore:

- fetchBlocks desde Supabase.
- createBlock con optimistic update.
- updateBlock con optimistic update.
- deleteBlock.
- deleteBlockSeries.
- duplicateBlock.
- setStatus.
- applyRecurrence.
- syncStatuses.

Detalles importantes:

- createBlock redondea tiempos a grilla de 15 minutos.
- Si hay recurrence, genera ocurrencias hasta 90 dias.
- createBlock enriquece metadata de actividad:
  - resolveBlockEngagementMode
  - resolveBlockFocusRequirement
  - resolveBlockExperienceRecordGeneration
  - resolveBlockSocialDemandHint
  - resolveBlockLocationMode
  - resolveBlockPresenceMode
- updateBlock registra reschedule activity si cambia start/end.
- updateBlock puede inferir activity experience cuando el bloque se completa,
  se cancela o ya paso.
- syncStatuses usa getBlockEffectiveStatus para reconciliar planned/active/etc.

Componentes de calendario:

- components/calendar/DailyAgendaView.tsx
- components/calendar/GlassCalendarDashboard.tsx
- components/calendar/WeekView.tsx
- components/calendar/RadialBlockMenu.tsx
- components/calendar/CreateBlockModal.tsx
- components/calendar/BlockDrawer.tsx
- components/calendar/BlockItem.tsx
- components/calendar/OverlapResolutionModal.tsx

Regla para otra IA:

Si se cambia el modelo de Block, actualizar:

- lib/types/blocks.ts
- lib/stores/blocksStore.ts
- Supabase schema/migrations
- server/planning si afecta recomendaciones
- activityExperience domain si afecta tipo/modo de actividad
- UI de RadialBlockMenu/CreateBlockModal si afecta edicion

===============================================================================
10. FOCUS MODE
===============================================================================

Tipos:

- lib/types/focus.ts

Store:

- lib/stores/focusStore.ts

Servicios:

- lib/services/focusService.ts

Hooks:

- hooks/useFocusRemoteSync.ts
- hooks/useFocusRuntimeSignals.ts
- hooks/useFocusTimer.ts
- hooks/useRestTimer.ts
- hooks/useStudyCountdown.ts
- hooks/useFocusNow.ts

Componentes:

- components/focus/FocusOverlay.tsx
- components/focus/FocusEntryRitual.tsx
- components/focus/FocusCardsCarousel.tsx
- components/focus/FocusCard.tsx
- components/focus/FocusInterventionModal.tsx
- components/focus/FocusPlannerModal.tsx
- components/focus/ReflectionSheet.tsx
- components/focus/TechniquePickerCard.tsx
- components/focus/RestSelector.tsx
- components/focus/IntentInputOverlay.tsx
- components/focus/GymTrackerPanel.tsx
- components/focus/FocusWaveBackground.tsx

Responsabilidades de focusStore:

- Persistir estado local en localStorage key focus-storage.
- Normalizar sesiones persistidas.
- Abrir foco desde bloque: openFromBlock.
- Abrir foco libre: openFree.
- Pausar/reanudar/salir/finalizar.
- Manejar layers de tecnica:
  - study
  - pomodoro
  - active recall
  - gym
  - attention aid
- Guardar intention/next step/minimum viable step.
- Manejar entry ritual.
- Manejar cards/interventions.
- Registrar senales de inactividad/estabilidad.
- Gestionar tracker de gym.

Persistencia de foco:

- syncActiveSession:
  - upsert minimal de sesion activa en focus_sessions.
- persistCompletedSession:
  - upsert sesion completa.
  - inserta focus_session_events.
  - inserta focus_session_interventions.
  - llama /api/analytics/consolidate con scope session.

Flujo de cierre:

1. Usuario finaliza sesion.
2. focusStore calcula closure type con resolveSessionClosureType.
3. Marca status pending/persisted/failed.
4. persistCompletedSession guarda datos.
5. trackHabitEvent registra evento de habito.
6. Si hay bloque asociado, setStatus completed.
7. Consolidacion de analytics actualiza inteligencia personal.

Realtime remoto:

- useFocusRemoteSync escucha tabla focus_sessions por Supabase Realtime.
- Permite hidratar/inyectar sesion activa entre dispositivos.

Runtime signals:

- useFocusRuntimeSignals detecta inactividad y actividad.
- Threshold visible: 90 segundos.
- Trackea exposicion de cards/toasts y eventos de recuperacion.

Engines de foco:

- lib/engines/focusContext.ts
  Construye FocusContext desde sesion, bloques y settings.

- lib/engines/cardsEngine.ts
  Evalua contexto y produce cards, toasts/interventions, con conflicto y
  cooldowns.

- lib/engines/focusEntryRitual.ts
  Recomienda modo de entrada y crea estado de ritual.

- lib/engines/layersEngine.ts
  Define/gestiona capas de estudio, pomodoro, gym y ayudas de atencion.

===============================================================================
11. HABIT CONTEXT Y EVENTOS DE HABITO
===============================================================================

Tipos:

- lib/types/habit.ts

Server:

- lib/server/habit.ts

Service:

- lib/services/habitService.ts

Engine:

- lib/engines/habit/selectors.ts
- lib/engines/habit/capture.ts

API:

- GET  /api/habit/home
- GET  /api/habit/widget
- POST /api/habit/onboarding
- POST /api/habit/events

HabitHomeData incluye:

- summary
- nextBlock
- rescuePlan
- dailyRitual
- weeklyConsistency
- adaptiveRecommendation
- preferences/onboarding/calibration
- widget data

lib/server/habit.ts combina:

- Behavior profile.
- Insights dashboard.
- Bloques.
- Analytics recientes.
- Actividad reciente.
- Preferencias de habit en profiles.preferences.habit.
- Eventos de habit_event_logs.

Eventos:

- Se guardan en habit_event_logs.
- Tambien se usan eventos de sistema:
  - meaningful_day_counted
  - consistency_target_reached

Selectores:

- Determinan bloque relevante.
- Calculan estado de ritual diario.
- Calculan consistencia semanal.
- Generan rescue plan.
- Producen adaptive recommendations.
- Calculan calibration progress.

Captura de habito:

- lib/engines/habit/capture.ts usa el planner heuristic para convertir texto
  en propuesta local.
- Exporta humanizeBlockTitle.

Regla para otra IA:

Todo evento nuevo que afecte aprendizaje/adaptacion deberia pasar por
trackHabitEvent o recordHabitEvent, no solo por console.log/UI state.

===============================================================================
12. PLANNER INTELIGENTE POR TEXTO
===============================================================================

Esta parte esta actualmente en archivos nuevos/no trackeados, por lo que es
probablemente el area activa de trabajo.

Tipos:

- lib/types/planner.ts

Engine:

- lib/engines/planner/heuristic.ts

Server:

- lib/server/planner.ts
- lib/server/plannerPersistence.ts

API:

- POST /api/planning/planner/propose
- POST /api/planning/planner/decision
- POST /api/planning/planner/apply

UI:

- components/habit/HabitCaptureCard.tsx
- components/habit/HabitPlanningProposalSheet.tsx
- components/home/HabitContext.tsx

Persistencia:

- supabase/migrations/20260413010000_planner_persistence_v1.sql
- Tablas:
  - planner_sessions
  - planner_inputs
  - planner_proposals
  - planner_decisions
  - planner_applied_blocks
- habit_event_logs suma campos de planner:
  - planner_session_id
  - planner_input_id
  - planner_proposal_id

Flujo:

1. Usuario escribe texto en HabitCaptureCard.
2. HabitContext llama requestPlannerProposal.
3. planningService llama /api/planning/planner/propose.
4. lib/server/planner.ts arma PlannerContextBundle:
   - bloques existentes.
   - ventanas libres.
   - overdue.
   - habit data.
   - user signals.
   - daily load.
5. lib/engines/planner/heuristic.ts interpreta texto.
6. Se crea planner_session/input/proposal.
7. UI muestra HabitPlanningProposalSheet.
8. Usuario decide:
   - apply
   - lighten
   - regenerate
   - edit
   - reject
9. Decisions se guardan.
10. Apply crea bloques y linkea planner_applied_blocks.

Heuristic planner:

- Divide texto por lineas, bullets, punto y coma y comas.
- Infere tipo por regex:
  - gym
  - meeting
  - admin
  - break
  - study
  - deep_work
- Limpia titulos.
- Parse explicit time y duration.
- Detecta overload.
- Usa:
  - findNextFreeSlot
  - best window del perfil/contexto
  - duracion recomendada
- Genera summary y drafts.
- Soporta lightenPlannerProposal.
- Soporta regeneratePlannerProposal.
- Soporta adjustPlannerProposalDraft.

Contratos conceptuales:

- PlannerRequest: entrada del usuario.
- PlannerContextBundle: contexto rico para planificar.
- PlannerInterpretation: intencion interpretada.
- PlannerProposal: propuesta mostrable/aplicable.
- PlannerRevision/Decision: decision del usuario.

Punto ideal para integrar IA/LLM:

- No reemplazar la UI ni el server completo.
- Integrar una IA como generador/interpretador dentro o al lado de
  lib/engines/planner/heuristic.ts, preservando el shape PlannerProposal.
- Usar buildPlannerContextBundle de lib/server/planner.ts como contexto.
- Persistir siempre via plannerPersistence.
- Mantener fallback heuristic si falla la IA.
- Registrar decisiones y eventos de habit para aprendizaje.

===============================================================================
13. PLANNING INTELLIGENCE Y RECOMENDACIONES
===============================================================================

Tipos:

- lib/types/planning.ts

Server:

- lib/server/planning.ts

Service:

- lib/services/planningService.ts

Engines:

- lib/engines/planningEngine/blockMetadata.ts
- lib/engines/planningEngine/dailyLoad.ts
- lib/engines/planningEngine/recommendations.ts

API:

- GET  /api/planning/day?date=YYYY-MM-DD
- GET  /api/planning/block/[blockId]?date=YYYY-MM-DD
- POST /api/planning/guide
- POST /api/planning/recommendations/[recommendationId]/accept
- POST /api/planning/recommendations/[recommendationId]/dismiss
- POST /api/planning/recommendations/[recommendationId]/apply

Planning guide combina:

- Bloques del dia.
- Behavior profile.
- Focus analytics recientes.
- Activity load.
- Feedback previo de recomendaciones.
- Preferencias del usuario.

Tipos de recomendaciones observadas:

- BEST_WINDOW_MISMATCH:
  mover bloque pesado/flexible a mejor ventana.
- SESSION_TOO_LONG:
  acortar/dividir sesion demasiado larga.
- HIGH_FRICTION_CATEGORY:
  empezar mas pequeno en categoria de alta friccion.
- DAY_OVERLOAD:
  reducir carga del dia.
- INTENSE_SEQUENCE:
  insertar break entre bloques intensos.
- Start small despues de baja energia residual, colaboracion o carga pasiva.
- PREMIUM_WINDOW_PROTECTION:
  proteger la mejor ventana si la ocupa un bloque de bajo valor.
- OVEROPTIMISTIC_PLAN:
  bajar objetivo si el plan suele ser demasiado optimista.

Acciones aplicables:

- move.
- shorten.
- split.
- insert_break.
- mark_optional.

lib/server/planning.ts:

- Mapea rows de Supabase a tipos.
- Persiste recomendaciones.
- Actualiza estados accepted/dismissed/applied.
- Aplica recomendaciones sobre blocks.
- Verifica conflictos de calendario con assertNoCalendarConflict.
- Tiene fallback de compatibilidad con columnas legacy de planning_recommendations.

Regla para otra IA:

No aplicar cambios de calendario directamente desde una recomendacion nueva.
Agregar primero la recomendacion al engine y luego usar applyPlanningRecommendation
para que se respeten conflictos, feedback y persistencia.

===============================================================================
14. ACTIVITY EXPERIENCE
===============================================================================

Proposito:

Capturar como se sintieron/funcionaron actividades, no solo sesiones de foco.
Esto alimenta patrones de energia, colaboracion, friccion, recuperacion,
logistica y confiabilidad.

Tipos:

- lib/types/activity.ts

Server:

- lib/server/activityExperience.ts

Service:

- lib/services/activityExperienceService.ts

Store:

- lib/stores/activityExperienceStore.ts

Engines:

- lib/engines/activityExperience/domain.ts
- lib/engines/activityExperience/analytics.ts

API:

- GET  /api/activity/day?date=YYYY-MM-DD
- GET  /api/activity/block/[blockId]
- POST /api/activity/block/[blockId]

POST /api/activity/block/[blockId] soporta acciones:

- rescheduled
- checkout
- infer/manual/default

domain.ts:

- Resuelve engagement mode de bloque.
- Resuelve si requiere focus mode.
- Resuelve si genera experience record.
- Resuelve social demand.
- Resuelve location/presence mode.
- Mapea focus sessions a activity experiences.
- Infiere experiencia desde bloque.
- Fusiona checkout manual.

analytics.ts:

- Calcula analytics de actividades no-focus.
- Calcula daily activity load.
- Detecta patrones:
  - fatiga post-meeting.
  - necesidad de buffers para colaboracion.
  - mejores ventanas para trabajo ligero.
  - confiabilidad de asistencia.
  - tendencia a posponer.
  - energia por modo de engagement.
  - fragmentacion logistica.
  - efecto de recuperacion.
- Construye behavior signals.
- Evalua aplicabilidad post-activity.

Regla para otra IA:

Cuando se agregue un nuevo tipo de bloque o metadata de actividad, actualizar
activityExperience domain y analytics para que el sistema siga aprendiendo.

===============================================================================
15. PERSONAL INTELLIGENCE / INSIGHTS
===============================================================================

Tipos:

- lib/types/behavior.ts

Server:

- lib/server/personalIntelligence.ts

Engines:

- lib/engines/personalIntelligence/sessionAnalytics.ts
- lib/engines/personalIntelligence/profileEngine.ts
- lib/engines/personalIntelligence/insightPresentation.ts
- lib/engines/personalIntelligence/momentum.ts
- lib/engines/personalIntelligence/evidence.ts

UI:

- app/insights/page.tsx
- components/insights/InsightsDashboard.tsx

API:

- POST /api/analytics/consolidate
- POST /api/analytics/consolidate/batch

Consolidation scopes:

- session
- daily
- weekly

sessionAnalytics.ts:

- Deriva FocusSessionAnalytics desde:
  - focus session.
  - events.
  - interventions.
- Calcula:
  - duracion real.
  - entrada.
  - tiempo activo.
  - pausas.
  - inactividad.
  - cambios de tarea.
  - aceptacion de intervenciones.
  - closure type.
  - progress score.
  - friction score.
  - consistency score.
  - behavior score.
  - diagnostics.

profileEngine.ts:

- Construye BehaviorProfile.
- Warmup stages:
  - cold: menos de 8 sesiones.
  - warming: 8 a 15 sesiones.
  - ready: 16 o mas sesiones.
- Detecta:
  - mejor ventana de foco.
  - duracion optima de sesion.
  - fuentes de friccion.
  - tendencia de consistencia.
  - mejoras recientes.
- Integra activity signals y analytics.

insightPresentation.ts:

- Convierte perfil/datos en cards de insight y resumen presentable.

momentum.ts:

- Senal diaria compuesta y trayectoria.

evidence.ts:

- Helpers de confianza/evidencia.

components/insights/InsightsDashboard.tsx:

- Muestra etapa de calibracion.
- Mejor ventana.
- Duracion recomendada.
- Friccion principal.
- Sesiones semanales.
- Completion/stability.
- Timeline, activity overview y memoria de perfil.

Regla para otra IA:

Para nuevas metricas, preferir:

1. Agregar calculo puro en engine.
2. Persistir en tablas analytics/profile si hace falta.
3. Exponer en server/personalIntelligence.
4. Renderizar en InsightsDashboard.

===============================================================================
16. NOTIFICACIONES WEB PUSH
===============================================================================

Archivos clave:

- lib/utils/notifications.ts
- lib/server/pushNotifications.ts
- public/sw.js
- app/api/notifications/vapid-public-key/route.ts
- app/api/notifications/send/route.ts
- app/api/notifications/test-ping/route.ts
- supabase/functions/send-block-reminders/index.ts

Tabla:

- push_subscriptions

Flujo cliente:

1. Settings o UI pide permiso de notificacion.
2. lib/utils/notifications.ts obtiene VAPID public key.
3. Registra service worker /sw.js.
4. Crea PushSubscription.
5. Upsert en push_subscriptions.

Envio desde app:

- /api/notifications/send envia push a suscripciones del usuario.
- Puede excluir endpoint actual.
- Elimina subscriptions invalidas.

Test:

- /api/notifications/test-ping espera 8 segundos y manda push de prueba.

Service Worker:

- public/sw.js maneja push.
- notificationclick abre target URL.

Edge function de recordatorios:

- supabase/functions/send-block-reminders/index.ts
- Usa service role y webpush.
- Busca bloques planned dentro de los proximos 121 minutos.
- Revisa offsets de notifications.
- Envia push a subscriptions del usuario.
- Borra subscriptions invalidas.

VAPID:

- NEXT_PUBLIC_VAPID_PUBLIC_KEY es para cliente.
- VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY son para servidor.

Regla para otra IA:

No asumir que las push funcionan si falta VAPID o service worker. Verificar
/api/notifications/vapid-public-key antes de diagnosticar UI.

===============================================================================
17. SUPABASE EDGE FUNCTIONS Y CRON
===============================================================================

supabase/config.toml define:

- send-block-reminders:
  - verify_jwt = true
  - import_map/deno config propio.

- personal-intelligence-consolidation:
  - verify_jwt = false
  - pensada para cron/invocacion interna.

personal-intelligence-consolidation:

- Archivo: supabase/functions/personal-intelligence-consolidation/index.ts
- Hace POST a:
  - APP_BASE_URL + /api/analytics/consolidate/batch
- Envia secreto:
  - x-agendo-cron-secret = PERSONAL_INTELLIGENCE_CRON_SECRET

/api/analytics/consolidate/batch:

- Endpoint publico a nivel middleware, pero protegido por secreto.
- Usa service role.
- Consolida daily/weekly en lote.

===============================================================================
18. BASE DE DATOS Y SCHEMA
===============================================================================

Schema consolidado:

- supabase/schema.sql

Migracion activa/open tab:

- supabase/migrations/20260413010000_planner_persistence_v1.sql

Tablas centrales:

profiles:

- id.
- username.
- preferences jsonb.
- trigger on_auth_user_created.

blocks:

- Calendario y planeamiento.
- Campos base: id, user_id, title, type, status, start_at, end_at, notes, tag,
  color, timestamps.
- Campos planning: priority, estimated_duration_minutes, difficulty,
  flexibility, intensity, deadline, cognitively_heavy, splittable, optional.
- Campos recurrence/notifications.
- Campos activity metadata: engagement_mode, requires_focus_mode,
  generates_experience_record, social_demand_hint, location_mode, presence_mode.

focus_sessions:

- Sesiones de foco activas/completadas.
- Incluye mood/reflection, layer/history, card memory, entry ritual,
  closure/intervention/event related fields.

focus_session_events:

- Eventos granulares de sesion.

focus_session_interventions:

- Intervenciones/cards/toasts aceptadas o ignoradas.

focus_session_analytics:

- Analitica derivada por sesion.

daily_metrics:

- Metricas por dia:
  - progress.
  - friction.
  - consistency.
  - emotion.
  - behavior.
  - momentum.
  - session counts.
  - activity load.

user_behavior_profile:

- Perfil agregado del usuario.

behavior_pattern_history:

- Historial de patrones detectados.

planning_recommendations:

- Recomendaciones persistidas.
- Incluye feedback, seen counts, applyability y suggested_action.

activity_experiences:

- Registros normalizados de experiencias de actividad/foco.

habit_event_logs:

- Eventos de habito y UI/contexto.
- Con campos nuevos de planner session/input/proposal.

planner_sessions:

- Sesion de captura/planning.

planner_inputs:

- Texto/input original e interpretacion.

planner_proposals:

- Propuesta generada/hidratable.

planner_decisions:

- Decisiones del usuario sobre propuesta.

planner_applied_blocks:

- Link entre proposal y blocks creados/aplicados.

gym_routines:

- Rutinas de gimnasio del usuario.

user_settings:

- Preferencias de usuario.

push_subscriptions:

- Suscripciones web push.

RLS:

- El schema tiene politicas de ownership por user_id en tablas principales.
- Cualquier escritura debe incluir user_id correcto.
- No usar service role para saltarse RLS salvo jobs internos/server admin.

Migraciones destacadas:

- 20260311234351_create_push_subscriptions.sql
- 20260311215400_add_block_notifications.sql
- 20260311211946_add_notification_settings.sql
- 20260311235000_schedule_push_notifications.sql
- 20260312201300_tracking_v1.sql
- 20260316103000_personal_intelligence_v2.sql
- 20260316121500_schedule_personal_intelligence_consolidation.sql
- 20260316190000_planning_intelligence_v3.sql
- 20260316213000_planning_v3_closure_fix.sql
- 20260317103000_activity_experience_v4.sql
- 20260327120000_add_language_to_user_settings.sql
- 20260412110000_habit_event_logs.sql
- 20260413010000_planner_persistence_v1.sql

SQL adicionales:

- supabase/01_gym_routines.sql
- supabase/02_user_settings.sql

===============================================================================
19. API ROUTES RESUMIDAS
===============================================================================

Home/Habit:

- GET /api/home/summary
  Devuelve resumen para home desde getHomeSummaryData.

- GET /api/habit/home
  Devuelve HabitHomeData desde getHabitHomeData.

- GET /api/habit/widget
  Devuelve habit.widget.

- POST /api/habit/onboarding
  Actualiza preferencias de habit y opcionalmente registra evento.

- POST /api/habit/events
  Registra HabitEventPayload.

Planning:

- GET /api/planning/day?date=YYYY-MM-DD
  Devuelve guia del dia.

- GET /api/planning/block/[blockId]?date=YYYY-MM-DD
  Devuelve guia enfocada en un bloque.

- POST /api/planning/guide
  Genera guia con preferencias/targetBlockId.

- POST /api/planning/recommendations/[recommendationId]/accept
  Acepta recomendacion.

- POST /api/planning/recommendations/[recommendationId]/dismiss
  Descarta recomendacion.

- POST /api/planning/recommendations/[recommendationId]/apply
  Aplica accion de recomendacion.

Planner:

- POST /api/planning/planner/propose
  Genera y persiste propuesta desde input textual.

- POST /api/planning/planner/decision
  Registra decision/revision: lighten, regenerate, edit, reject.

- POST /api/planning/planner/apply
  Aplica propuesta creando/modificando bloques.

Activity:

- GET /api/activity/day?date=YYYY-MM-DD
  Trae experiencias recientes del dia.

- GET /api/activity/block/[blockId]
  Trae experiencia asociada a bloque.

- POST /api/activity/block/[blockId]
  Infiere, checkout o registra reschedule.

Analytics:

- POST /api/analytics/consolidate
  Consolidacion autenticada session/daily/weekly.

- POST /api/analytics/consolidate/batch
  Consolidacion interna por secreto.

Notifications:

- GET /api/notifications/vapid-public-key
  Devuelve key/estado VAPID, no-store.

- POST /api/notifications/send
  Envia push al usuario.

- POST /api/notifications/test-ping
  Test push con delay de 8 segundos.

Auth:

- GET /auth/callback
  Intercambia code por session.

===============================================================================
20. STORES ZUSTAND
===============================================================================

lib/stores/blocksStore.ts:

- Estado de bloques del calendario.
- Operaciones optimistas.
- Sincronizacion de estado efectivo.
- Recurrencia hasta 90 dias.
- Activity metadata e inference.

lib/stores/focusStore.ts:

- Estado global de sesion de foco.
- Persistencia local.
- Entry ritual.
- Layers.
- Interventions/cards.
- Gym tracker.
- Persistencia remota y consolidacion via focusService.

lib/stores/settingsStore.ts:

- Preferencias del usuario.
- Persistencia local + Supabase.
- Sincronizacion de idioma.
- Tolerancia a schema viejo.

lib/stores/gymStore.ts:

- CRUD de gym_routines.

lib/stores/activityExperienceStore.ts:

- Carga experiencias de dia/bloque.
- Infer/check-out/upsert.

Regla para otra IA:

Si una accion cambia estado de UI y persistencia, revisar si ya corresponde a
un store. No duplicar fetches/supabase calls en componentes.

===============================================================================
21. SERVICIOS CLIENTE/SERVER
===============================================================================

lib/services/habitService.ts:

- fetchHabitHome.
- saveHabitOnboarding.
- trackHabitEvent.
- Usa sendBeacon cuando puede, fetch keepalive como fallback.

lib/services/planningService.ts:

- Fetch wrappers de guide/recommendations/planner.
- canApplyRecommendation.

lib/services/focusService.ts:

- syncActiveSession.
- persistCompletedSession.
- saveSessionReflection.
- Llama consolidacion de analytics despues de persistir.

lib/services/activityExperienceService.ts:

- Fetch day/block experience.
- infer.
- checkout.
- reschedule.
- En server construye URL absoluta desde env app URL.

Regla para otra IA:

Cuando se agregue endpoint, crear o extender service correspondiente para no
dispersar fetch manual por componentes.

===============================================================================
22. COMPONENTES Y UI IMPORTANTES
===============================================================================

Home:

- app/page.tsx
- components/home/HabitContext.tsx
- components/home/SectionCalendar.tsx
- components/home/SectionIntro.tsx
- components/home/UserMenu.tsx

Habit/planner:

- components/habit/HabitCaptureCard.tsx
- components/habit/HabitActivationSheet.tsx
- components/habit/HabitPlanningProposalSheet.tsx

Calendar:

- components/calendar/DailyAgendaView.tsx
- components/calendar/GlassCalendarDashboard.tsx
- components/calendar/RadialBlockMenu.tsx
- components/calendar/CreateBlockModal.tsx
- components/calendar/BlockDrawer.tsx
- components/calendar/WeekView.tsx

Focus:

- components/focus/FocusOverlay.tsx
- components/focus/FocusEntryRitual.tsx
- components/focus/FocusCardsCarousel.tsx
- components/focus/FocusInterventionModal.tsx
- components/focus/ReflectionSheet.tsx
- components/focus/GymTrackerPanel.tsx

Insights:

- components/insights/InsightsDashboard.tsx

Settings:

- components/settings/SettingsSidebar.tsx
- app/settings/profile/page.tsx
- app/settings/appearance/page.tsx
- app/settings/preferences/page.tsx
- app/settings/notifications/page.tsx
- app/settings/language/page.tsx
- app/settings/account/page.tsx

UI primitives:

- components/ui/*

Regla de diseno observada:

- La app usa estetica dark/glass/motion con superficies densas.
- Mantener consistencia con los patrones existentes.
- Para iconos, usar lucide-react si existe un icono adecuado.

===============================================================================
23. FLUJOS PRINCIPALES DE DATOS
===============================================================================

Flujo A: login

1. Usuario entra a /login.
2. Server action login/signup.
3. Supabase Auth crea/valida sesion.
4. Middleware mantiene cookies.
5. App protegida carga home.

Flujo B: home habit context

1. app/page monta HabitContext.
2. HabitContext llama fetchHabitHome.
3. /api/habit/home llama lib/server/habit.ts.
4. Server combina blocks + intelligence + activity + preferences + events.
5. UI muestra next block, ritual, consistency, rescue, planner.
6. UI registra eventos via /api/habit/events.

Flujo C: captura textual a planning proposal

1. Usuario escribe "tengo que estudiar, gym y ordenar mails".
2. HabitCaptureCard envia request.
3. /api/planning/planner/propose arma contexto.
4. heuristic/IA genera PlannerProposal.
5. Proposal se guarda.
6. UI muestra sheet con drafts.
7. Usuario aplica/revisa/rechaza.
8. Decisiones quedan persistidas.
9. Apply crea blocks y linkea applied blocks.

Flujo D: creacion/edicion de bloque

1. UI calendario llama createBlock/updateBlock.
2. blocksStore hace optimistic update.
3. Supabase persist.
4. Si cambia tiempo, registra reschedule activity.
5. Si se completa/cancela, puede inferir activity experience.
6. syncStatuses ajusta estados efectivos por tiempo.

Flujo E: sesion de foco

1. Usuario abre foco desde block o libre.
2. focusStore crea session.
3. syncActiveSession guarda estado activo.
4. runtime signals/cards/interventions generan eventos.
5. Usuario finaliza.
6. persistCompletedSession guarda sesion/eventos/intervenciones.
7. /api/analytics/consolidate scope session recalcula analytics.
8. Personal intelligence/profile se alimenta.
9. Block asociado puede marcarse completed.

Flujo F: activity checkout

1. Bloque termina o usuario hace checkout.
2. /api/activity/block/[blockId] infer/checkout.
3. activity_experiences se actualiza.
4. daily activity load y behavior signals usan esos datos.
5. Planning recommendations pueden cambiar.

Flujo G: recomendaciones adaptativas

1. Server planning calcula DailyLoadSnapshot.
2. recommendations.ts produce recomendaciones.
3. Server persiste planning_recommendations.
4. UI muestra y registra seen/accepted/dismissed/applied.
5. Feedback afecta futuras recomendaciones.

Flujo H: push reminders

1. Usuario habilita notificaciones.
2. Cliente guarda push_subscription.
3. Edge function o API route envia push.
4. service worker muestra notification.
5. Click abre URL target/deep link.

===============================================================================
24. TESTS EXISTENTES
===============================================================================

Framework:

- Vitest.

Areas con tests detectados:

- focus:
  - focusEntryRitual.test.ts
  - focusContext.test.ts
  - cardsEngine.test.ts

- focus store:
  - focusStore.test.ts

- blocks:
  - blocksStore.test.ts
  - blockState.test.ts

- planning:
  - planningService.test.ts
  - dailyLoad.test.ts
  - recommendations.test.ts
  - lib/server/planning.test.ts

- planner/habit:
  - lib/engines/planner/heuristic.test.ts
  - lib/engines/habit/capture.test.ts
  - lib/engines/habit/selectors.test.ts

- activity experience:
  - domain.test.ts
  - analytics.test.ts
  - lib/server/activityExperience.test.ts

- personal intelligence:
  - sessionAnalytics.test.ts
  - profileEngine.test.ts
  - lib/server/personalIntelligence.test.ts

Comandos recomendados:

- npm run test
- npm run lint
- npm run build

Regla para otra IA:

Si se toca un engine, agregar/actualizar tests del engine. Si se toca server
module con Supabase mocks, revisar tests server existentes para patrones.

===============================================================================
25. INTEGRACION DE OTRA IA: PUNTOS RECOMENDADOS
===============================================================================

Caso 1: IA para planificar desde lenguaje natural

Punto de entrada recomendado:

- lib/server/planner.ts para contexto/orquestacion.
- lib/engines/planner/heuristic.ts como fallback o comparador.
- lib/types/planner.ts para contrato de salida.

Contrato que debe respetar:

- Entrada: PlannerRequest + PlannerContextBundle.
- Salida: PlannerProposal validable/aplicable.
- Persistencia: plannerPersistence.
- UI: HabitPlanningProposalSheet.

Recomendacion tecnica:

- Agregar un adapter, por ejemplo:
  - lib/engines/planner/aiPlanner.ts
  - o lib/server/plannerAi.ts
- Mantener fallback heuristic.
- Validar que drafts no se solapen.
- Validar fechas/duracion.
- Nunca crear bloques directamente desde la respuesta cruda de la IA.
- Convertir respuesta a PlannerProposal y aplicar via applyPlannerProposal.

Caso 2: IA para recomendaciones de comportamiento

Punto de entrada recomendado:

- lib/engines/planningEngine/recommendations.ts
- lib/server/planning.ts
- lib/engines/personalIntelligence/*

Contrato:

- Nueva recomendacion debe mapear a PlanningRecommendation.
- suggestedAction debe ser aplicable o claramente no aplicable.
- Debe integrarse con feedback de usuario.

Caso 3: IA conversacional dentro de la app

Punto de entrada recomendado:

- Nueva API route bajo app/api/assistant o similar.
- Usar server-side context builders:
  - getHabitHomeData
  - getPlanningGuideData
  - buildPlannerContextBundle
  - getInsightsDashboardData
- No exponer service role.
- Respetar RLS y user_id.

Caso 4: IA para insights narrativos

Punto de entrada recomendado:

- lib/server/personalIntelligence.ts para datos.
- lib/engines/personalIntelligence/insightPresentation.ts para presentacion.
- components/insights/InsightsDashboard.tsx para UI.

Caso 5: IA para clasificar actividades

Punto de entrada recomendado:

- lib/engines/activityExperience/domain.ts
- lib/engines/activityExperience/analytics.ts

Contrato:

- No romper engagement/location/presence/social/cognitive enums.
- Si se agregan nuevos enums, migrar DB y types.

===============================================================================
26. REGLAS DE SEGURIDAD Y CONSISTENCIA PARA MODIFICAR EL REPO
===============================================================================

1. No saltarse RLS desde cliente.

2. No usar SUPABASE_SERVICE_ROLE_KEY fuera del server.

3. No crear endpoints que devuelvan datos de otro usuario.

4. Toda tabla user-owned debe filtrar por user.id.

5. Fechas:
   - En UI y stores se usan Date.
   - En APIs y DB se serializan como ISO strings.
   - Cuidar timezone local del usuario.

6. Blocks:
   - Validar startAt < endAt.
   - Evitar solapamientos cuando aplica.
   - Usar metadata helpers existentes.

7. Planning:
   - Usar applyPlanningRecommendation o applyPlannerProposal.
   - No escribir blocks arbitrariamente desde sugerencias IA.

8. Focus:
   - Persistir session/events/interventions en conjunto.
   - No perder eventos al cerrar sesion.

9. Habit:
   - Registrar eventos significativos para aprendizaje.

10. Notifications:
   - Verificar permission, service worker, VAPID y subscription.
   - Borrar subscriptions invalidas.

11. Encoding:
   - Revisar strings con mojibake antes de editar.

12. Dirty worktree:
   - No revertir cambios ajenos.
   - Leer archivos modificados antes de parchear.

===============================================================================
27. DETALLES DE NEXT.JS / APP ROUTER
===============================================================================

- El proyecto usa App Router.
- Muchas paginas server obtienen usuario con createClient server-side.
- Rutas API exportan handlers GET/POST.
- Con Next moderno, route params pueden tratarse como Promise en algunos
  handlers. Respetar patrones ya usados en el repo.
- proxy.ts reemplaza el middleware convencional para manejo global.
- El layout global monta FocusOverlay, por eso el foco esta disponible desde
  cualquier pagina protegida.

===============================================================================
28. GIMNASIO / GYM
===============================================================================

Store:

- lib/stores/gymStore.ts

Tabla:

- gym_routines

Componentes:

- components/focus/GymTrackerPanel.tsx
- components/focus/gym/*

Focus integration:

- El focusStore tiene gym tracker.
- layersEngine incluye layer gym.
- Blocks tipo gym se clasifican con engagement/activity metadata especial.

Regla para otra IA:

No tratar gym como solo "otro bloque". Tiene UI y runtime especificos dentro de
focus mode.

===============================================================================
29. CONFIGURACION DE SUPABASE
===============================================================================

lib/supabase/config.ts:

- Valida env vars.
- Detecta placeholders.
- requireSupabaseConfig falla si falta config.
- tryCreate... permite degradacion cuando config no esta.

lib/supabase/client.ts:

- createBrowserClient.
- tryCreateClient.
- getClientUser.

lib/supabase/server.ts:

- createServerClient con bridge de cookies.

lib/supabase/admin.ts:

- service role client.
- Solo server/admin jobs.

lib/supabase/middleware.ts:

- Actualiza sesion.
- Redirecciona segun auth.

===============================================================================
30. DEUDA TECNICA / AREAS A TRATAR CON CUIDADO
===============================================================================

- Encoding/mojibake visible en strings.
- Algunas superficies parecen legacy/alternativas:
  - components/home/SectionContext.tsx
  - components/home/home-shell.tsx
  - scripts replace*.js
- Planner persistence esta en archivos nuevos sin trackear; confirmar estado
  antes de asumir que ya fue migrado en ambiente remoto.
- planning_recommendations tiene compatibilidad legacy; no limpiar sin revisar
  migrations reales.
- settingsStore tolera columnas faltantes; puede indicar que algunos entornos
  aun no tienen schema actualizado.
- Edge functions dependen de env y deploy Supabase, no solo de Next.

===============================================================================
31. CHECKLIST RAPIDA PARA UNA IA QUE VA A TRABAJAR EN AGENDO
===============================================================================

Antes de tocar codigo:

- Leer package.json.
- Leer tipos en lib/types del dominio afectado.
- Buscar tests del engine/server correspondiente.
- Revisar si el archivo esta modificado/no trackeado.
- Revisar schema/migrations si se toca persistencia.

Si se agrega feature de planner:

- Mantener PlannerProposal.
- Persistir session/input/proposal/decision.
- Registrar habit events.
- Usar apply path existente.
- Agregar tests en lib/engines/planner.

Si se agrega feature de bloques/calendario:

- Actualizar Block type.
- Actualizar DB si hay campos nuevos.
- Actualizar blocksStore.
- Actualizar UI editor.
- Revisar planning/activity/focus effects.

Si se agrega feature de analytics:

- Engine puro primero.
- Server consolidation despues.
- DB/schema si se persiste.
- Insights UI al final.
- Tests.

Si se agrega feature de notifications:

- Cliente subscription.
- Server send.
- SW click target.
- Edge function si es programada.
- Env docs.

===============================================================================
32. RESUMEN MENTAL DEL PRODUCTO
===============================================================================

Agendo intenta responder a:

- Que tengo que hacer ahora?
- Como protejo mi energia y mi mejor ventana del dia?
- Como convierto intenciones vagas en bloques concretos?
- Que patrones aprende la app sobre mi foco, friccion y recuperacion?
- Como me ayuda sin sobrecargarme con recomendaciones irrelevantes?

Por eso casi todos los modulos se conectan:

- Blocks dan estructura temporal.
- Focus sessions dan evidencia conductual.
- Activity experiences dan contexto fuera del foco.
- Personal intelligence transforma evidencia en perfil.
- Planning engine usa perfil + calendario para sugerir cambios.
- Habit context convierte todo eso en una superficie diaria simple.
- Planner textual convierte intenciones en acciones concretas.

La mejor integracion de IA debe amplificar esa arquitectura, no reemplazarla:
generar mejores propuestas, mejores interpretaciones y mejores explicaciones,
pero siempre pasando por los contratos, validaciones y persistencia existentes.

===============================================================================
FIN DEL DOCUMENTO
===============================================================================
