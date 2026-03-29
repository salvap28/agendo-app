import type { AppLanguage } from "./messages";

export function getTechniquePickerCopy(language: AppLanguage) {
    return language === "es"
        ? {
            title: "Elegir tecnica",
            cancel: "Cancelar",
            focus: "Foco",
            rest: "Descanso",
            restartTimer: "Reiniciar timer",
            keepTimer: "Mantener timer",
            select: "Seleccionar",
            techniques: {
                pomodoro_25_5: {
                    name: "Pomodoro (25/5)",
                    desc: "Trabaja 25 minutos y descansa 5. Ideal para arrancar con suavidad y sostener un ritmo estable.",
                },
                study_50_10: {
                    name: "Bloque 50/10",
                    desc: "Sesiones de 50 minutos con 10 de descanso. Perfecto para trabajo profundo, lectura o estudio intenso.",
                },
                active_recall: {
                    name: "Active Recall",
                    desc: "Refuerza la memoria de largo plazo obligandote a recuperar lo que aprendiste cada 20 minutos. (Modo MVP)",
                },
            },
        }
        : {
            title: "Choose technique",
            cancel: "Cancel",
            focus: "Focus",
            rest: "Rest",
            restartTimer: "Restart timer",
            keepTimer: "Keep timer",
            select: "Select",
            techniques: {
                pomodoro_25_5: {
                    name: "Pomodoro (25/5)",
                    desc: "Work for 25 minutes, then rest for 5. Ideal for easing in and keeping a sustainable rhythm.",
                },
                study_50_10: {
                    name: "50/10 Block",
                    desc: "Fifty-minute sessions with a 10-minute rest. Great for deep work, reading, or intense study.",
                },
                active_recall: {
                    name: "Active Recall",
                    desc: "Strengthens long-term memory by making you retrieve what you learned every 20 minutes. (MVP mode)",
                },
            },
        };
}

export function getFocusInterventionCopy(language: AppLanguage) {
    return language === "es"
        ? {
            defaultMinimumViable: "Hacer una parte mas chica",
            defaultNextStep: "Definir el siguiente paso",
            reduceScope: {
                title: "Reduce el alcance",
                description: "Elige la version minima que todavia te haga avanzar.",
                workFive: "Trabajar 5 min",
                firstStep: "Hacer primer paso",
                splitTask: "Dividir tarea",
            },
            resetClarity: {
                title: "Vuelve al objetivo",
                noGoal: "No hay un objetivo definido para esta sesion.",
                keepObjective: "Mantener objetivo",
                rewriteObjective: "Reescribir objetivo",
                currentGoal: (value: string) => `Tu objetivo actual es: "${value}".`,
            },
            refocus: {
                title: "Vuelve al bloque",
                chooseOne: "Elige una sola accion y retoma desde ahi.",
                returnNow: "Volver ahora",
                defineFocus: "Definir foco",
                resumeFrom: (value: string) => `Retoma desde: "${value}".`,
            },
            progress: {
                title: "Chequeo rapido",
                description: "Marca como viene la sesion para ajustar el foco sin cortar el ritmo.",
                advancing: "Avanzando bien",
                slower: "Mas lento",
                blocked: "Estoy trabado",
            },
            closure: {
                title: "Cerrando el bloque",
                description: "Si quieres, deja en una frase lo mas importante que avanzaste.",
                placeholder: "Ej: cerre el algoritmo y deje listo el siguiente paso",
                save: "Guardar",
                skip: "Saltar",
            },
            close: "Cerrar",
        }
        : {
            defaultMinimumViable: "Do a smaller version",
            defaultNextStep: "Define the next step",
            reduceScope: {
                title: "Reduce the scope",
                description: "Choose the minimum version that still moves you forward.",
                workFive: "Work 5 min",
                firstStep: "Do the first step",
                splitTask: "Split task",
            },
            resetClarity: {
                title: "Return to the objective",
                noGoal: "There is no defined objective for this session.",
                keepObjective: "Keep objective",
                rewriteObjective: "Rewrite objective",
                currentGoal: (value: string) => `Your current objective is: "${value}".`,
            },
            refocus: {
                title: "Return to the block",
                chooseOne: "Choose one action and resume from there.",
                returnNow: "Return now",
                defineFocus: "Define focus",
                resumeFrom: (value: string) => `Resume from: "${value}".`,
            },
            progress: {
                title: "Quick check-in",
                description: "Mark how the session is going so you can adjust focus without breaking momentum.",
                advancing: "Moving well",
                slower: "Slower",
                blocked: "I am blocked",
            },
            closure: {
                title: "Closing the block",
                description: "If you want, leave one sentence with the most important thing you moved forward.",
                placeholder: "Ex: I closed the algorithm and left the next step ready",
                save: "Save",
                skip: "Skip",
            },
            close: "Close",
        };
}

export function getFocusEntryCopy(language: AppLanguage) {
    return language === "es"
        ? {
            titles: {
                objective: "Que te gustaria cerrar en este bloque?",
                nextStep: "Cual va a ser tu primer paso?",
                mode: "Como quieres arrancar?",
            },
            subtitles: {
                objective: "Una frase corta. Pensemos juntos en lo que quieres dejar hecho.",
                nextStep: "Lo primero que vas a hacer apenas entres. Mejor si es simple y visible.",
                mode: "Elige la ayuda que mejor te acompana hoy. Si quieres, entra directo.",
            },
            helpers: {
                objective: "Piensalo como resultado, no como deseo. Algo claro y concreto.",
                nextStep: "Algo chico y real: abrir un archivo, leer una hoja o empezar el primer ejercicio.",
                mode: "Normal si ya estas listo. Micro compromiso si cuesta arrancar. Las otras opciones te guian.",
            },
            actions: {
                resume: "Retomar:",
                useBlockTitle: "Usar titulo del bloque",
                continueWith: "Seguir con:",
                useBlockNote: "Usar nota del bloque",
                suggested: "Sugerido",
                minimumViable: "Minimo viable",
                minimumViablePlaceholder: "Ej: abrir el archivo y escribir una linea",
                back: "Atras",
                skipForNow: "Omitir por ahora",
                startBlock: "Empezar bloque",
                continue: "Continuar",
            },
            modes: {
                studyTechnique: { label: "Tecnica de estudio", hint: "Te acompana con estructura" },
                gymTracker: { label: "Seguimiento gym", hint: "Series, descansos y progreso", entryHint: "Entrar con seguimiento" },
                microCommit: { label: "Micro compromiso", hint: "Cinco minutos para arrancar" },
                normal: { label: "Modo normal", hint: "Entrar directo" },
            },
            examples: {
                deep_work: {
                    objective: "Ej: dejar lista la estructura del informe",
                    nextStep: "Ej: abrir el documento y escribir la primera seccion",
                },
                study: {
                    objective: "Ej: entender y repasar el tema 3",
                    nextStep: "Ej: abrir apuntes y resolver el ejercicio 4",
                },
                gym: {
                    objective: "Ej: completar pecho y hombro",
                    nextStep: "Ej: empezar por pecho inclinado",
                },
                meeting: {
                    objective: "Ej: salir con las decisiones clave definidas",
                    nextStep: "Ej: abrir la agenda y revisar el primer punto",
                },
                admin: {
                    objective: "Ej: ordenar pendientes clave",
                    nextStep: "Ej: responder el primer mail importante",
                },
                break: {
                    objective: "Ej: recuperar energia y despejar la cabeza",
                    nextStep: "Ej: alejarme de la pantalla y respirar un minuto",
                },
                other: {
                    objective: "Ej: avanzar una parte concreta",
                    nextStep: "Ej: abrir lo necesario y hacer la primera accion",
                },
                free: {
                    objective: "Ej: terminar lo mas importante de esta sesion",
                    nextStep: "Ej: abrir el material y empezar",
                },
            },
        }
        : {
            titles: {
                objective: "What would you like to close in this block?",
                nextStep: "What will your first step be?",
                mode: "How do you want to begin?",
            },
            subtitles: {
                objective: "One short sentence. Let's define together what you want to leave done.",
                nextStep: "The first thing you will do as soon as you enter. Best if it is simple and visible.",
                mode: "Choose the support that fits you best today. If you want, enter directly.",
            },
            helpers: {
                objective: "Think of it as an outcome, not a wish. Something clear and concrete.",
                nextStep: "Something small and real: open a file, read a page, or start the first exercise.",
                mode: "Standard if you are ready. Micro commit if starting feels hard. The other options guide you.",
            },
            actions: {
                resume: "Resume:",
                useBlockTitle: "Use block title",
                continueWith: "Continue with:",
                useBlockNote: "Use block note",
                suggested: "Suggested",
                minimumViable: "Minimum viable",
                minimumViablePlaceholder: "Ex: open the file and write one line",
                back: "Back",
                skipForNow: "Skip for now",
                startBlock: "Start block",
                continue: "Continue",
            },
            modes: {
                studyTechnique: { label: "Study technique", hint: "Guides you with structure" },
                gymTracker: { label: "Gym tracker", hint: "Sets, rest, and progress", entryHint: "Enter with tracking" },
                microCommit: { label: "Micro commit", hint: "Five minutes to get moving" },
                normal: { label: "Standard mode", hint: "Enter directly" },
            },
            examples: {
                deep_work: {
                    objective: "Ex: finish the report structure",
                    nextStep: "Ex: open the document and write the first section",
                },
                study: {
                    objective: "Ex: understand and review topic 3",
                    nextStep: "Ex: open the notes and solve exercise 4",
                },
                gym: {
                    objective: "Ex: complete chest and shoulders",
                    nextStep: "Ex: start with incline bench",
                },
                meeting: {
                    objective: "Ex: leave with the key decisions clarified",
                    nextStep: "Ex: open the agenda and review the first point",
                },
                admin: {
                    objective: "Ex: organize the key pending items",
                    nextStep: "Ex: answer the first important email",
                },
                break: {
                    objective: "Ex: recover energy and clear your head",
                    nextStep: "Ex: step away from the screen and breathe for a minute",
                },
                other: {
                    objective: "Ex: move one concrete part forward",
                    nextStep: "Ex: open what you need and do the first action",
                },
                free: {
                    objective: "Ex: finish the most important thing in this session",
                    nextStep: "Ex: open the material and begin",
                },
            },
        };
}

export function getIntentInputCopy(language: AppLanguage) {
    return language === "es"
        ? {
            nextStepTitle: "Cual es el siguiente paso?",
            completionTitle: "Objetivo cumplido",
            intentionTitle: "Cual es el objetivo?",
            nextStepDescription: "Define la accion concreta que sigue para no perder el arranque.",
            completionDescription: "Escribe tu proximo paso para mantener el impulso, o cierra para continuar libremente.",
            intentionDescription: "Define en una frase corta que quieres lograr en este bloque.",
            nextStepPlaceholder: "Ej: abrir apuntes y resolver el ejercicio 4...",
            completionPlaceholder: "Ej: repasar el siguiente capitulo...",
            intentionPlaceholder: "Ej: cerrar la estructura del informe...",
            maybeLater: "Quizas luego",
            cancel: "Cancelar",
            saveStep: "Guardar paso",
            setObjective: "Fijar objetivo",
        }
        : {
            nextStepTitle: "What is the next step?",
            completionTitle: "Objective completed",
            intentionTitle: "What is the objective?",
            nextStepDescription: "Define the concrete action that comes next so you do not lose momentum.",
            completionDescription: "Write your next step to keep the momentum, or close this and continue freely.",
            intentionDescription: "Define in one short sentence what you want to achieve in this block.",
            nextStepPlaceholder: "Ex: open the notes and solve exercise 4...",
            completionPlaceholder: "Ex: review the next chapter...",
            intentionPlaceholder: "Ex: finish the report structure...",
            maybeLater: "Maybe later",
            cancel: "Cancel",
            saveStep: "Save step",
            setObjective: "Set objective",
        };
}

export function getFocusPlannerCopy(language: AppLanguage) {
    return language === "es"
        ? {
            defaultTitle: "Sesion de foco",
            modalTitle: "Planificar foco",
            save: "Guardar",
            placeholder: "Tema de foco: (Sesion de trabajo profundo)",
        }
        : {
            defaultTitle: "Focus session",
            modalTitle: "Plan your focus",
            save: "Save",
            placeholder: "Focus subject: (Deep work session)",
        };
}

export function getFocusOverlayCopy(language: AppLanguage) {
    return language === "es"
        ? {
            startedTitle: "Bien. Ya arrancaste.",
            startedBody: "Ahora sigue con el bloque principal.",
            focusProtectionActive: "Proteccion de foco activa",
            previousRestored: "Intencion anterior restaurada",
            currentPhaseFocus: "Foco",
            currentPhaseBreak: "Descanso",
            markProgress: "Marcar avance y definir el siguiente paso",
            remove: "Eliminar",
            microCommitCompleted: "Micro compromiso completado",
            activeRecallOpened: "Active recall abierto",
            closureBridgeAcknowledged: "Cierre confirmado",
            attentionAidEnabled: (layerId: string) => `Ayuda de atencion activada: ${layerId}`,
            layerLabels: {
                study5010: "50/10 - Foco",
                pomodoro: "Pomodoro 25/5",
                gymMode: "Modo gym",
                microCommit: "Micro compromiso 5:00",
                focusProtection: "Proteccion de foco",
                activeIntervention: "Intervencion activa",
            },
        }
        : {
            startedTitle: "Good. You already started.",
            startedBody: "Now continue with the main block.",
            focusProtectionActive: "Focus protection active",
            previousRestored: "Previous intention restored",
            currentPhaseFocus: "Focus",
            currentPhaseBreak: "Break",
            markProgress: "Mark progress and define the next step",
            remove: "Remove",
            microCommitCompleted: "Micro commit completed",
            activeRecallOpened: "Active recall opened",
            closureBridgeAcknowledged: "Closure bridge acknowledged",
            attentionAidEnabled: (layerId: string) => `Attention aid enabled: ${layerId}`,
            layerLabels: {
                study5010: "50/10 - Focus",
                pomodoro: "Pomodoro 25/5",
                gymMode: "Gym mode",
                microCommit: "Micro commit 5:00",
                focusProtection: "Focus protection",
                activeIntervention: "Active intervention",
            },
        };
}

export function getReflectionCopy(language: AppLanguage) {
    return language === "es"
        ? {
            questions: [
                "Que fue lo mas valioso de este bloque?",
                "Que te gustaria repetir de esta sesion?",
                "Como cierras este bloque mentalmente?",
            ],
            progressOptions: {
                minimal: { label: "Minimo", hint: "Apenas salio" },
                solid: { label: "Solido", hint: "Se movio bien" },
                strong: { label: "Potente", hint: "Despego fuerte" },
            },
            difficultyOptions: {
                light: { label: "Ligero", hint: "Fluyo facil" },
                tense: { label: "Tenso", hint: "Pidio foco" },
                heavy: { label: "Pesado", hint: "Costo sostener" },
            },
            moodOptions: {
                low: { label: "Bajo", hint: "Quede drenado" },
                calm: { label: "Sereno", hint: "Estoy neutro" },
                good: { label: "Bien", hint: "Quede conforme" },
                up: { label: "Arriba", hint: "Quede activado" },
            },
            freeBlockTitle: "Bloque de foco",
            closeBadge: "Cierre",
            sessionCompleted: "Sesion completada",
            blockCompleted: "Bloque completado",
            progressLabel: "Avance logrado",
            progressDescription: "Marca el nivel de progreso real. Esta es la metrica principal.",
            primary: "Principal",
            difficultyLabel: "Dificultad",
            difficultyDescription: "Que tan costoso fue sostener el bloque?",
            moodLabel: "Animo final",
            moodDescription: "Elige como terminaste esta sesion.",
            closureHintTitle: "Antes anotaste",
            closureHintBody: "Si quieres, suma algo mas sobre como termino la sesion.",
            notePlaceholder: "Nota mental opcional...",
            saving: "Guardando...",
            saveAndFinish: "Guardar y finalizar",
        }
        : {
            questions: [
                "What felt most valuable in this block?",
                "What would you like to repeat from this session?",
                "How are you closing this block mentally?",
            ],
            progressOptions: {
                minimal: { label: "Minimal", hint: "It barely moved" },
                solid: { label: "Solid", hint: "It moved well" },
                strong: { label: "Strong", hint: "It really took off" },
            },
            difficultyOptions: {
                light: { label: "Light", hint: "It flowed easily" },
                tense: { label: "Tense", hint: "It demanded focus" },
                heavy: { label: "Heavy", hint: "It was hard to sustain" },
            },
            moodOptions: {
                low: { label: "Low", hint: "I ended drained" },
                calm: { label: "Calm", hint: "I feel neutral" },
                good: { label: "Good", hint: "I ended satisfied" },
                up: { label: "Up", hint: "I ended energized" },
            },
            freeBlockTitle: "Focus block",
            closeBadge: "Closure",
            sessionCompleted: "Session completed",
            blockCompleted: "Block completed",
            progressLabel: "Progress made",
            progressDescription: "Mark the real level of progress. This is the main metric.",
            primary: "Primary",
            difficultyLabel: "Difficulty",
            difficultyDescription: "How hard was it to sustain this block?",
            moodLabel: "Final mood",
            moodDescription: "Choose how you ended this session.",
            closureHintTitle: "You noted earlier",
            closureHintBody: "If you want, add one more note about how the session ended.",
            notePlaceholder: "Optional mental note...",
            saving: "Saving...",
            saveAndFinish: "Save and finish",
        };
}

export function getCreateBlockModalCopy(language: AppLanguage) {
    return language === "es"
        ? {
            defaultTitle: "Nuevo bloque",
            schedule: "Horario",
            start: "Inicio",
            end: "Fin",
            recurrence: "Repeticion",
            once: "Una vez",
            cancel: "Cancelar",
            save: "Crear bloque",
        }
        : {
            defaultTitle: "New block",
            schedule: "Schedule",
            start: "Start",
            end: "End",
            recurrence: "Recurrence",
            once: "Once",
            cancel: "Cancel",
            save: "Create block",
        };
}

export function getGymRoutineConfigCopy(language: AppLanguage) {
    return language === "es"
        ? {
            newRoutine: "Nueva rutina",
            routineName: "Nombre de la rutina",
            color: "Color",
            schedule: "Planificacion",
            restTimer: "Timer de descanso",
            exercises: "Ejercicios",
            addExercise: "Anadir ejercicio (Enter)...",
            saveRoutine: "Guardar rutina",
        }
        : {
            newRoutine: "New routine",
            routineName: "Routine name",
            color: "Color",
            schedule: "Schedule",
            restTimer: "Rest timer",
            exercises: "Exercises",
            addExercise: "Add exercise (Enter)...",
            saveRoutine: "Save routine",
        };
}

export function getGymDashboardCopy(language: AppLanguage) {
    return language === "es"
        ? {
            routines: "Rutinas",
            newRoutine: "Nueva rutina",
            newRoutineBody: "Crea un plan de ejercicios personalizado",
            workouts: "Entrenamientos",
            loading: "Cargando rutinas...",
            exercisesCount: (count: number) => `${count} ejercicios`,
            rest: "Descanso",
        }
        : {
            routines: "Routines",
            newRoutine: "New routine",
            newRoutineBody: "Create a personalized workout plan",
            workouts: "Workouts",
            loading: "Loading routines...",
            exercisesCount: (count: number) => `${count} exercises`,
            rest: "Rest",
        };
}

export function getGymActiveSessionCopy(language: AppLanguage) {
    return language === "es"
        ? {
            restFinishedTitle: "Descanso terminado",
            restFinishedBody: "Listo para la siguiente serie.",
            skipRest: "Saltar descanso",
            workoutFallback: "Entrenamiento",
            rest: "descanso",
            warmUp: "Calentamiento",
            set: "Serie",
            reps: "Reps",
            weight: "Peso",
            addSet: "Anadir serie",
            finishWorkout: "Finalizar entrenamiento",
        }
        : {
            restFinishedTitle: "Rest finished",
            restFinishedBody: "Ready for the next set.",
            skipRest: "Skip rest",
            workoutFallback: "Workout",
            rest: "rest",
            warmUp: "Warm-up",
            set: "Set",
            reps: "Reps",
            weight: "Weight",
            addSet: "Add set",
            finishWorkout: "Finish workout",
        };
}

export function getRadialBlockMenuCopy(language: AppLanguage) {
    return language === "es"
        ? {
            category: "Categoria",
            focus: "Foco",
            schedule: "Horario",
            status: "Estado",
            alerts: "Avisos",
            delete: "Eliminar",
            title: "Titulo",
            blockNamePlaceholder: "Nombre del bloque",
            planningMetadata: "Metadatos de planificacion",
            intensityLight: "Liviano",
            intensityMedium: "Medio",
            intensityHigh: "Intenso",
            flexibilityFixed: "Fijo",
            flexibilityModerate: "Moderado",
            flexibilityFlexible: "Flexible",
            splittableYes: "Divisible",
            splittableNo: "No divisible",
            optionalYes: "Opcional",
            optionalNo: "Obligatorio",
            recurrence: "Repeticion",
            recurrenceNone: "No",
            custom: "A medida",
            back: "Volver",
            cancel: "Cancelar",
            next: "Siguiente",
            save: "Guardar",
            atTime: "En el momento",
            minutesBefore: (minutes: number) => `${minutes} min antes`,
            agendoBlock: "Bloque Agendo",
            focusMode: "Modo foco",
            confirm: "Confirmar",
            confirmAndContinue: "Confirmar y continuar",
            agendoOptions: "Opciones de Agendo",
            agendoSuggestions: "Sugerencias de Agendo",
            aiRecommended: "Ajustes tacticos recomendados por IA para este bloque.",
            analyzing: "Analizando...",
            refreshSuggestions: "Refrescar sugerencias",
            noSuggestions: "Este bloque esta bien estructurado y no requiere intervencion por ahora.",
            deleteRecurringTitle: "Eliminar bloque repetitivo?",
            deleteRecurringDescription: "Este bloque forma parte de una repeticion. Deseas eliminar solo este horario o todos los horarios vinculados?",
            onlyThis: "Solo este",
            all: "Todos",
        }
        : {
            category: "Category",
            focus: "Focus",
            schedule: "Schedule",
            status: "Status",
            alerts: "Alerts",
            delete: "Delete",
            title: "Title",
            blockNamePlaceholder: "Block name",
            planningMetadata: "Planning metadata",
            intensityLight: "Light",
            intensityMedium: "Medium",
            intensityHigh: "Intense",
            flexibilityFixed: "Fixed",
            flexibilityModerate: "Moderate",
            flexibilityFlexible: "Flexible",
            splittableYes: "Splittable",
            splittableNo: "Not splittable",
            optionalYes: "Optional",
            optionalNo: "Required",
            recurrence: "Recurrence",
            recurrenceNone: "No repeat",
            custom: "Custom",
            back: "Back",
            cancel: "Cancel",
            next: "Next",
            save: "Save",
            atTime: "At time",
            minutesBefore: (minutes: number) => `${minutes} min before`,
            agendoBlock: "Agendo block",
            focusMode: "Focus mode",
            confirm: "Confirm",
            confirmAndContinue: "Confirm and continue",
            agendoOptions: "Agendo options",
            agendoSuggestions: "Agendo suggestions",
            aiRecommended: "Tactical adjustments recommended by AI for this block.",
            analyzing: "Analyzing...",
            refreshSuggestions: "Refresh suggestions",
            noSuggestions: "This block is well structured and does not need intervention right now.",
            deleteRecurringTitle: "Delete recurring block?",
            deleteRecurringDescription: "This block belongs to a recurrence. Do you want to remove only this time slot or every linked occurrence?",
            onlyThis: "Only this",
            all: "All",
        };
}

export function getOverlapResolutionCopy(language: AppLanguage) {
    return language === "es"
        ? {
            title: "Conflicto de horario",
            comingSoon: "Proximamente",
            scheduleConflictDescription: (overlappingCount: number) =>
                `Este bloque se superpone con ${overlappingCount > 1 ? `${overlappingCount} bloques existentes` : "1 bloque existente"}. Como te gustaria resolverlo?`,
            options: {
                intelligent: {
                    title: "Reorganizacion inteligente",
                    description: "La IA buscara la mejor distribucion de tu dia conservando tu energia.",
                    badge: "Proximamente",
                },
                sliceUnderlying: {
                    title: "Recortar bloque subyacente",
                    description: "Divide o acorta los bloques existentes para abrir paso a este nuevo.",
                },
                shrinkNew: {
                    title: "Ajustar duracion de este bloque",
                    description: "Recorta este bloque para que encaje en el espacio libre disponible.",
                },
                moveForward: {
                    title: "Mover al proximo hueco libre",
                    description: "Desplaza automaticamente este bloque al siguiente espacio vacio.",
                },
                keepOverlap: {
                    title: "Mantener superpuestos",
                    description: "Ignora el conflicto y guarda el bloque exactamente aqui.",
                },
            },
        }
        : {
            title: "Schedule conflict",
            comingSoon: "Coming soon",
            scheduleConflictDescription: (overlappingCount: number) =>
                `This block overlaps with ${overlappingCount > 1 ? `${overlappingCount} existing blocks` : "1 existing block"}. How would you like to resolve it?`,
            options: {
                intelligent: {
                    title: "Intelligent reorganization",
                    description: "AI will search for the best way to redistribute your day without draining your energy.",
                    badge: "Coming soon",
                },
                sliceUnderlying: {
                    title: "Trim underlying block",
                    description: "Split or shorten the existing blocks to make room for this one.",
                },
                shrinkNew: {
                    title: "Adjust this block length",
                    description: "Shorten this block so it fits the available free space.",
                },
                moveForward: {
                    title: "Move to the next free slot",
                    description: "Automatically move this block to the next open slot.",
                },
                keepOverlap: {
                    title: "Keep overlapping",
                    description: "Ignore the conflict and save the block exactly here.",
                },
            },
        };
}
