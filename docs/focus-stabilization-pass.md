# Focus Stabilization Pass

## Objetivo

Este documento describe los ultimos arreglos aplicados al modulo Focus de Agendo durante la fase de estabilizacion.

El objetivo de esta fase no fue agregar features nuevas, sino corregir la base tecnica del runtime para que el sistema quede confiable y listo para evolucionar despues hacia capas mas complejas como Entry Ritual, Recovery System profundo, Closure Bridge y analitica avanzada.

La estabilizacion se concentro en seis ejes:

1. Tiempo y contexto vivo.
2. Restauracion del contrato funcional de toasts.
3. Memoria minima por card y cooldowns.
4. Intervenciones estructuradas y persistibles.
5. Separacion entre descanso intencional y friccion.
6. Correccion de la carrera entre finish y reflection.

Ademas se ajustaron el detector de `SessionState`, varios flows de intervencion, parte de la convivencia entre cards viejas y nuevas, y la cobertura de tests del engine.

---

## Estado previo

Antes de esta estabilizacion el sistema tenia una buena direccion conceptual, pero mantenia varias fragilidades en runtime:

- `sessionProgress` se calculaba bien, pero no gobernaba en vivo cards, toasts y buckets.
- `FocusOverlay` y `FocusCardsCarousel` dependian demasiado de cambios del store para reevaluar el engine.
- Los toasts del engine se degradaban a texto simple y perdian prioridad, CTAs y handlers reales.
- No existia memoria por card dentro de la sesion, por lo que algunas cards reaparecian demasiado.
- La nocion de intervencion era transitoria; no habia historial estructurado.
- Los descansos intencionales sumaban a `pauseCount` y contaminaban señales de friccion.
- La reflexion final podia intentar actualizar una sesion antes de que la fila existiera efectivamente en Supabase.

El resultado era un runtime que funcionaba, pero con comportamiento no suficientemente predecible para seguir escalando el Focus Mode.

---

## Cambios principales por archivo

### `hooks/useFocusNow.ts`

Se agrego una fuente temporal viva unica para el runtime de Focus.

Responsabilidad:

- exponer un `now` actualizado con una frecuencia razonable
- evitar multiples relojes paralelos
- convertirse en el punto de entrada temporal para overlay, countdowns y evaluacion contextual

Con esto el tiempo deja de estar disperso entre varios componentes y hooks.

### `lib/engines/focusContext.ts`

Paso a ser la fuente central de contexto temporal y semantico.

Cambios:

- unificacion de calculo de `elapsedMs`
- unificacion de calculo de `plannedDurationMs`
- unificacion de calculo de `sessionProgress`
- soporte explicito para `lastSession`
- soporte para `cardMemory`
- soporte para `restPauses`
- soporte para `lastPauseReason`
- soporte para layer activa

La regla importante es que `elapsedMs` y `sessionProgress` salen siempre del mismo lugar.

### `components/focus/FocusOverlay.tsx`

Fue refactorizado para dejar de ser un consumidor pasivo del store y pasar a ser el coordinador de runtime vivo.

Cambios:

- consume `useFocusNow()`
- construye `FocusContext` vivo con `buildFocusContext(...)`
- ejecuta el engine de cards y toasts en tiempo real
- mantiene el toast seleccionado como objeto completo
- ejecuta acciones reales de cards y toasts
- marca exposicion de cards visibles
- registra outcomes de cards y toasts
- abre intervenciones estructuradas cuando corresponde

Adicionalmente:

- el boton de pausa explicita `manual_pause`
- la salida del overlay usa `overlay_exit`
- la logica de `micro_commit_layer` deja de depender de timers duplicados

### `components/focus/FocusCardsCarousel.tsx`

Se simplifico su responsabilidad.

Antes mezclaba presentacion con reevaluacion contextual.

Ahora:

- recibe cards ya resueltas
- se limita a renderizar
- delega logica de runtime al overlay

Esto reduce duplicacion y evita fuentes de verdad paralelas.

### `lib/engines/cardsEngine.ts`

Fue estabilizado como motor de decision contextual.

Cambios:

- ajuste parcial del detector de `SessionState`
- resolucion explicita de conflictos entre cards
- soporte para memoria por card
- soporte para cooldowns
- restauracion de toasts con prioridad y acciones completas
- limpieza parcial de cards hibridas para que no opaquen intervenciones mas importantes

Tambien se exporto la politica `focusCardCooldowns`, consumida por el store para persistir memoria de exposicion y outcomes.

### `lib/stores/focusStore.ts`

Fue el cambio estructural mas importante del lado de estado.

Cambios:

- se agrego `lastPauseReason`
- se agrego `restCount`
- se agrego `cardMemory`
- se agrego `persistenceStatus`
- se agrego `interventions: FocusInterventionRecord[]`
- `pause()` ahora distingue entre razones
- `exit()` usa `overlay_exit`
- `finish()` entra en estado `pending` antes de persistir
- `finish()` marca `persisted` o `failed` segun resultado real
- se agregaron helpers para `markCardShown`
- se agregaron helpers para `recordCardOutcome`
- se agregaron helpers para abrir, resolver y cerrar intervenciones
- el persist del store ahora incluye intervenciones e informacion relevante de estabilizacion

Tambien se agregaron normalizadores para soportar datos legacy del store persistido.

### `components/focus/FocusInterventionModal.tsx`

Las intervenciones dejaron de ser casi cosmeticas.

Cambios:

- cada flow deja outcome estructurado
- las acciones aceptadas o rechazadas registran resultado real
- `reduce_scope` puede iniciar `micro_commit_layer` o reescribir la intencion
- `reset_clarity` permite mantener o redefinir el objetivo
- `refocus_prompt` puede activar `focus_protection_layer`
- `progress_check` deja resultado persistible

El modal ahora participa del runtime de Focus como parte del sistema de decision, no como simple UI auxiliar.

### `hooks/useRestTimer.ts`

Se corrigio la semantica de descanso.

Antes el descanso intencional usaba `pause()` de la misma forma que una pausa por friccion.

Ahora:

- usa `manual_rest`
- no incrementa `pauseCount`
- no alimenta falsamente `SLOW_START`, `FRICTION` ni `toast_pause`

### `components/focus/ReflectionSheet.tsx`

Se corrigio el contrato de apertura.

Ahora la reflexion solo se muestra si:

- la sesion termino
- y `persistenceStatus === "persisted"`

Eso elimina la carrera donde la reflexion podia actualizar una fila todavia inexistente en Supabase.

### `hooks/useFocusTimer.ts` y `hooks/useStudyCountdown.ts`

Se ajustaron para consumir la misma fuente temporal viva y dejar de duplicar calculos de tiempo.

### `lib/types/focus.ts`

Se actualizo el contrato de tipos del modulo.

Cambios principales:

- `FocusPauseReason`
- `FocusCardMemory`
- `FocusInterventionRecord`
- nuevos campos en `FocusSession`
- nuevos campos en `FocusContext`

Esto deja una base de tipos mucho mas coherente para runtime, persistencia y analitica futura.

---

## Detalle tecnico de los problemas resueltos

## 1. Tiempo y contexto vivo

### Problema

`sessionProgress` existia, pero no era la fuente real de verdad del runtime. Si el store no cambiaba, el engine tampoco progresaba de forma visible.

### Solucion

Se introdujo un reloj vivo unico (`useFocusNow`) y se centralizo el calculo contextual en `buildFocusContext`.

Flujo actual:

1. `useFocusNow()` produce `now`.
2. `FocusOverlay` arma `FocusContext` con `buildFocusContext`.
3. `cardsEngine` decide cards visibles, toasts y estado de sesion usando ese contexto.
4. `FocusCardsCarousel` solo renderiza.

### Efecto

Ahora progresan correctamente en vivo:

- `sessionProgress`
- thresholds de cards
- `toast_near_end`
- mid-progress checks
- buckets contextuales
- deteccion de flow y friccion

---

## 2. Restauracion del contrato funcional de toasts

### Problema

El engine generaba toasts ricos, pero el overlay los colapsaba a `title` y `description`.

Eso hacia que:

- se perdieran prioridades
- se perdieran acciones
- `toast_near_end` no pudiera extender o finalizar
- prompts como active recall quedaran reducidos a decoracion

### Solucion

El overlay ahora renderiza el toast como objeto completo del sistema.

Cada toast conserva:

- `id`
- `title`
- `description`
- `priority`
- `action`
- `secondaryAction`
- metadata contextual

### Efecto

Los toasts vuelven a ser intervenciones reales y no simples etiquetas visuales.

---

## 3. Memoria minima por card y cooldowns

### Problema

No habia una politica minima de no repeticion dentro de una sesion.

Consecuencia:

- cards como `card_micro_commit`
- `card_reduce_scope`
- `card_reset_clarity`
- `card_return_to_focus`
- `card_progress_check`

podian reaparecer demasiado rapido o varias veces sin necesidad.

### Solucion

Se incorporo `FocusCardMemory` y se agrego memoria por card dentro de la sesion.

Cada entrada registra:

- primer momento de exposicion
- ultimo momento de exposicion
- cantidad de veces mostrada
- ultimo dismiss
- ultimo accepted
- ultimo rejected
- `cooldownUntil`

El engine consulta esta memoria antes de volver a proponer una card o toast.

### Efecto

El sistema conserva comportamiento contextual, pero deja de sentirse insistente.

---

## 4. Intervenciones estructuradas

### Problema

La intervencion activa existia solo como estado transitorio. No habia historial estructurado para analitica futura o para conectar outcome con calidad de sesion.

### Solucion

Se agrego `FocusInterventionRecord` y un historial `interventions[]` en el store.

Cada registro puede guardar:

- `id`
- `sessionId`
- `timestamp`
- `type`
- `sourceCard`
- `sourceToast`
- `trigger`
- `actionTaken`
- `result`
- `payload`

### Efecto

Cada intervencion deja memoria real y persistible. Esto no implementa aun analitica avanzada, pero deja el contrato listo para usar despues.

---

## 5. Separacion entre descanso intencional y friccion

### Problema

El descanso manual se registraba igual que una pausa por deterioro de foco.

Eso sesgaba:

- `pauseCount`
- `SLOW_START`
- `FRICTION`
- `toast_pause`
- ayudas de desbloqueo

### Solucion

Se introdujo razon explicita de pausa:

- `manual_pause`
- `manual_rest`
- `overlay_exit`

Solo `manual_pause` alimenta la señal de friccion.

### Efecto

El sistema ya no interpreta descansos planificados como si fueran perdida de foco.

---

## 6. Correccion de la carrera finish/reflection

### Problema

La sesion podia marcarse visualmente como finalizada antes de que la fila estuviera insertada en Supabase, y la reflexion final podia intentar actualizar algo todavia no persistido.

### Solucion

Se definio un estado intermedio de persistencia:

- `draft`
- `pending`
- `persisted`
- `failed`

`finish()` ahora:

1. cierra logicamente la sesion
2. marca `pending`
3. persiste en Supabase
4. actualiza a `persisted` o `failed`

`ReflectionSheet` solo abre sobre `persisted`.

### Efecto

Se elimina la posibilidad de que la reflexion escriba sobre una fila inexistente.

---

## Ajustes del detector de SessionState

El detector no fue redisenado por completo, pero si se endurecio.

Cambios relevantes:

- `ENTRY` ya no depende solo de intencion vacia
- `DISTRACTED` y `FRICTION` quedaron mejor separados
- `FLOW` se reserva para sesiones estables
- `NORMAL_FLOW` y `MID_PROGRESS` quedan mejor delimitados
- se evita mezclar mas de la cuenta flow con cards de friccion
- el motor toma en cuenta mejor pausas, exits, progreso y contexto de la sesion

La idea fue hacer una mejora parcial robusta, no abrir otra reescritura grande.

---

## Limpieza de hibridos contextuales

No se eliminaron ayudas viejas, pero si se reviso que no rompan la filosofia del sistema.

### `card_playlist`

Se mantuvo, pero mas contenida para que no opaque cards de recuperacion.

### `card_next_step`

Se saco de dependencia rigida con tiempo absoluto viejo y se acerco mas a estado contextual y progreso real.

### `card_study_technique`

No se fuerza si ya hay una layer activa equivalente.

### `card_gym_mode`

Se evita que compita inutilmente si el modo gym ya esta representado por la layer correspondiente.

Resultado:

El sistema sigue teniendo compatibilidad con la capa anterior, pero se siente menos como una caja de utilidades fija.

---

## Endurecimiento de flows de intervencion

En esta fase se corrigio especialmente que varias intervenciones no quedaran reducidas a escribir strings sueltos en `history`.

### `reduce_scope`

Ahora puede producir efectos reales:

- iniciar `micro_commit_layer`
- redefinir intencion
- abrir una redefinicion mas concreta del trabajo

### `reset_clarity`

Ahora puede:

- confirmar el foco actual
- o forzar una reescritura del objetivo

### `refocus_prompt`

Ahora puede:

- activar `focus_protection_layer`
- o llevar al usuario a redefinir foco

### `progress_check`

Ahora deja outcome estructurado en lugar de ser solo una interaccion efimera.

---

## Compatibilidad con el Focus actual

Esta fase no rompio la compatibilidad base del sistema actual.

Se mantuvieron integraciones importantes:

- cards previas relevantes
- layers previas
- overlay existente
- reflexion final
- persistencia en Supabase
- relacion con bloques del calendario

Se reforzo la base sin forzar un redisenio total del producto.

---

## Cobertura de tests agregada

Se agregaron y/o actualizaron tests en:

- `lib/engines/focusContext.test.ts`
- `lib/engines/cardsEngine.test.ts`
- `lib/stores/focusStore.test.ts`

Cobertura introducida:

- calculo centralizado de `elapsedMs`
- calculo centralizado de `sessionProgress`
- congelamiento del tiempo al pausar
- cambio vivo de estado y cards al progresar la sesion
- prioridad de toasts
- preservacion de acciones de toasts
- exclusion por cooldown
- separacion entre descanso intencional y friccion
- persistencia correcta del cierre antes de reflection
- registro estructurado de intervenciones

Esto no cubre todo el modulo, pero si blinda la base nueva del engine.

---

## Verificacion final de la fase

Se valido:

- `npm test`: OK
- `npm run build`: OK
- compatibilidad general del Focus actual: mantenida

Durante el build siguen apareciendo warnings de CSS por `@property`, pero son ajenos a esta estabilizacion y no bloquean compilacion.

---

## Conclusiones

Despues de esta fase, el modulo Focus queda en un estado claramente mas estable:

- el tiempo gobierna de verdad el runtime
- el contexto es unico y consistente
- los toasts recuperan funcionalidad real
- las cards ya no insisten sin control
- las intervenciones dejan memoria estructurada
- la señal de friccion es mas limpia
- la transicion finish/reflection deja de tener carrera
- el engine queda cubierto por tests sobre la base nueva

En terminos practicos, esta estabilizacion deja el sistema listo para avanzar a la siguiente etapa sin seguir apilandose sobre una base fragil.
