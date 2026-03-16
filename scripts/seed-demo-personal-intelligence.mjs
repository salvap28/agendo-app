import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DEMO_EMAIL = "demo.personal.intelligence@agendo.app";
const DEMO_PASSWORD = "AgendoDemo2026!";
const DEMO_USERNAME = "demo-insights";
const DEMO_FULL_NAME = "Agendo Demo";
const DEMO_APP_BASE_URL = "https://agendo-app-chi.vercel.app";

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function resolveFocusWindow(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function resolveDurationBucket(durationMinutes) {
  if (durationMinutes < 25) return "short";
  if (durationMinutes < 50) return "medium";
  if (durationMinutes < 80) return "long";
  return "extended";
}

function calculateMomentumDay(progressScore, consistencyScore, frictionScore, behaviorScore) {
  const momentum =
    (progressScore * 0.4) +
    (consistencyScore * 0.25) -
    (frictionScore * 0.2) +
    (behaviorScore * 0.15) +
    15;

  return clamp(Math.round(momentum), 0, 100);
}

function calculateMomentumTotal(metrics) {
  if (metrics.length === 0) return 0;

  const now = new Date();
  let weekSum = 0;
  let weekCount = 0;
  let monthSum = 0;
  let monthCount = 0;

  for (const metric of metrics) {
    const diffDays = (now.getTime() - new Date(metric.date).getTime()) / (1000 * 3600 * 24);
    const value = metric.momentum_day || 0;

    if (diffDays <= 7) {
      weekSum += value;
      weekCount += 1;
    }

    if (diffDays <= 21) {
      monthSum += value;
      monthCount += 1;
    }
  }

  const weekAvg = weekCount > 0 ? weekSum / weekCount : 0;
  const monthAvg = monthCount > 0 ? monthSum / monthCount : 0;
  return clamp(Math.round((weekAvg * 0.6) + (monthAvg * 0.4)), 0, 100);
}

function isoForDay(daysAgo, hour, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

function shiftIso(iso, minutes) {
  return new Date(new Date(iso).getTime() + (minutes * 60 * 1000)).toISOString();
}

function createSessionBlueprints() {
  return [
    { daysAgo: 24, hour: 9, durationMin: 42, blockType: "deep_work", progress: 71, friction: 31, consistency: 57, behavior: 70, stability: 0.74, continuity: 0.78, recovery: 0.7, pauses: 1, exits: 0, inactivityCount: 0, pauseMin: 4, inactivityMin: 0, startDelayMin: 2, difficulty: 4, clarity: 3, completion: 0.86, closureType: "completed", interventions: [] },
    { daysAgo: 22, hour: 19, durationMin: 68, blockType: "admin", progress: 56, friction: 73, consistency: 49, behavior: 45, stability: 0.42, continuity: 0.5, recovery: 0.2, pauses: 2, exits: 1, inactivityCount: 1, pauseMin: 14, inactivityMin: 18, startDelayMin: 6, difficulty: 3, clarity: 2, completion: 0.61, closureType: "abandoned", interventions: [{ type: "reduce_scope", actionTaken: "close", result: "dismissed" }] },
    { daysAgo: 21, hour: 8, durationMin: 38, blockType: "study", progress: 74, friction: 28, consistency: 59, behavior: 72, stability: 0.77, continuity: 0.79, recovery: 0.8, pauses: 1, exits: 0, inactivityCount: 0, pauseMin: 3, inactivityMin: 0, startDelayMin: 2, difficulty: 4, clarity: 3, completion: 0.89, closureType: "completed", interventions: [] },
    { daysAgo: 19, hour: 9, durationMin: 44, blockType: "deep_work", progress: 76, friction: 27, consistency: 61, behavior: 74, stability: 0.79, continuity: 0.81, recovery: 0.8, pauses: 1, exits: 0, inactivityCount: 0, pauseMin: 4, inactivityMin: 0, startDelayMin: 2, difficulty: 4, clarity: 4, completion: 0.9, closureType: "completed", interventions: [] },
    { daysAgo: 17, hour: 20, durationMin: 72, blockType: "admin", progress: 54, friction: 76, consistency: 47, behavior: 43, stability: 0.4, continuity: 0.47, recovery: 0.15, pauses: 3, exits: 1, inactivityCount: 1, pauseMin: 15, inactivityMin: 20, startDelayMin: 7, difficulty: 3, clarity: 2, completion: 0.58, closureType: "abandoned", interventions: [{ type: "reduce_scope", actionTaken: "close", result: "dismissed" }] },
    { daysAgo: 16, hour: 8, durationMin: 41, blockType: "study", progress: 77, friction: 26, consistency: 60, behavior: 75, stability: 0.8, continuity: 0.82, recovery: 0.84, pauses: 1, exits: 0, inactivityCount: 0, pauseMin: 3, inactivityMin: 0, startDelayMin: 1, difficulty: 4, clarity: 4, completion: 0.91, closureType: "completed", interventions: [] },
    { daysAgo: 14, hour: 9, durationMin: 43, blockType: "deep_work", progress: 78, friction: 25, consistency: 62, behavior: 76, stability: 0.81, continuity: 0.83, recovery: 0.84, pauses: 1, exits: 0, inactivityCount: 0, pauseMin: 3, inactivityMin: 0, startDelayMin: 1, difficulty: 5, clarity: 4, completion: 0.92, closureType: "completed", interventions: [] },
    { daysAgo: 12, hour: 18, durationMin: 64, blockType: "admin", progress: 58, friction: 68, consistency: 52, behavior: 50, stability: 0.5, continuity: 0.56, recovery: 0.34, pauses: 2, exits: 1, inactivityCount: 1, pauseMin: 11, inactivityMin: 12, startDelayMin: 5, difficulty: 3, clarity: 2, completion: 0.7, closureType: "completed", interventions: [{ type: "progress_check", actionTaken: "accept", result: "accepted" }] },
    { daysAgo: 11, hour: 9, durationMin: 40, blockType: "deep_work", progress: 80, friction: 24, consistency: 64, behavior: 78, stability: 0.82, continuity: 0.84, recovery: 0.86, pauses: 1, exits: 0, inactivityCount: 0, pauseMin: 3, inactivityMin: 0, startDelayMin: 1, difficulty: 5, clarity: 4, completion: 0.93, closureType: "completed", interventions: [] },
    { daysAgo: 9, hour: 8, durationMin: 39, blockType: "study", progress: 81, friction: 23, consistency: 66, behavior: 79, stability: 0.84, continuity: 0.85, recovery: 0.88, pauses: 1, exits: 0, inactivityCount: 0, pauseMin: 2, inactivityMin: 0, startDelayMin: 1, difficulty: 4, clarity: 4, completion: 0.94, closureType: "completed", interventions: [] },
    { daysAgo: 8, hour: 19, durationMin: 61, blockType: "admin", progress: 60, friction: 66, consistency: 54, behavior: 52, stability: 0.53, continuity: 0.58, recovery: 0.38, pauses: 2, exits: 0, inactivityCount: 1, pauseMin: 10, inactivityMin: 11, startDelayMin: 4, difficulty: 3, clarity: 3, completion: 0.74, closureType: "completed", interventions: [{ type: "progress_check", actionTaken: "accept", result: "accepted" }] },
    { daysAgo: 6, hour: 9, durationMin: 43, blockType: "deep_work", progress: 86, friction: 18, consistency: 74, behavior: 86, stability: 0.9, continuity: 0.9, recovery: 0.92, pauses: 0, exits: 0, inactivityCount: 0, pauseMin: 0, inactivityMin: 0, startDelayMin: 1, difficulty: 5, clarity: 5, completion: 0.97, closureType: "completed", interventions: [] },
    { daysAgo: 5, hour: 8, durationMin: 41, blockType: "study", progress: 87, friction: 17, consistency: 76, behavior: 87, stability: 0.91, continuity: 0.91, recovery: 0.94, pauses: 0, exits: 0, inactivityCount: 0, pauseMin: 0, inactivityMin: 0, startDelayMin: 1, difficulty: 4, clarity: 5, completion: 0.97, closureType: "completed", interventions: [] },
    { daysAgo: 4, hour: 9, durationMin: 45, blockType: "deep_work", progress: 89, friction: 16, consistency: 79, behavior: 88, stability: 0.92, continuity: 0.92, recovery: 0.95, pauses: 0, exits: 0, inactivityCount: 0, pauseMin: 0, inactivityMin: 0, startDelayMin: 1, difficulty: 5, clarity: 5, completion: 0.98, closureType: "completed", interventions: [] },
    { daysAgo: 3, hour: 10, durationMin: 47, blockType: "deep_work", progress: 83, friction: 22, consistency: 77, behavior: 82, stability: 0.86, continuity: 0.87, recovery: 0.88, pauses: 1, exits: 0, inactivityCount: 0, pauseMin: 3, inactivityMin: 0, startDelayMin: 2, difficulty: 5, clarity: 4, completion: 0.94, closureType: "completed", interventions: [] },
    { daysAgo: 2, hour: 9, durationMin: 44, blockType: "deep_work", progress: 91, friction: 15, consistency: 82, behavior: 90, stability: 0.94, continuity: 0.93, recovery: 0.96, pauses: 0, exits: 0, inactivityCount: 0, pauseMin: 0, inactivityMin: 0, startDelayMin: 1, difficulty: 5, clarity: 5, completion: 0.99, closureType: "completed", interventions: [] },
    { daysAgo: 1, hour: 8, durationMin: 42, blockType: "study", progress: 92, friction: 14, consistency: 84, behavior: 91, stability: 0.95, continuity: 0.94, recovery: 0.97, pauses: 0, exits: 0, inactivityCount: 0, pauseMin: 0, inactivityMin: 0, startDelayMin: 1, difficulty: 4, clarity: 5, completion: 1, closureType: "completed", interventions: [] },
  ];
}

function buildSeedRows(userId) {
  const blueprints = createSessionBlueprints();
  const sessions = [];
  const analytics = [];
  const events = [];
  const interventions = [];

  blueprints.forEach((blueprint, index) => {
    const sessionId = `demo-seed-session-${index + 1}`;
    const startedAt = isoForDay(blueprint.daysAgo, blueprint.hour, 0);
    const initiatedAt = shiftIso(startedAt, -2);
    const endedAt = shiftIso(startedAt, blueprint.durationMin);
    const actualDurationMs = blueprint.durationMin * 60 * 1000;
    const pauseDurationMs = blueprint.pauseMin * 60 * 1000;
    const inactivityDurationMs = blueprint.inactivityMin * 60 * 1000;
    const activeDurationMs = actualDurationMs - pauseDurationMs - inactivityDurationMs;
    const plannedDurationMs = (resolveDurationBucket(blueprint.durationMin) === "medium" ? 45 : blueprint.durationMin) * 60 * 1000;
    const blockLabel = blueprint.blockType === "admin"
      ? "cerrar pendientes concretos"
      : blueprint.blockType === "study"
        ? "terminar una unidad clara"
        : "avanzar el bloque principal";

    sessions.push({
      id: sessionId,
      user_id: userId,
      mode: "block",
      block_id: null,
      block_type: blueprint.blockType,
      initiated_at: initiatedAt,
      consolidated_at: startedAt,
      started_at: startedAt,
      ended_at: endedAt,
      planned_duration_ms: plannedDurationMs,
      is_active: false,
      is_paused: false,
      paused_at: null,
      total_paused_ms: pauseDurationMs,
      pause_count: blueprint.pauses,
      exit_count: blueprint.exits,
      rest_count: 0,
      last_pause_reason: null,
      pause_events: blueprint.pauses > 0 ? [new Date(shiftIso(startedAt, 18)).getTime()] : [],
      exit_events: blueprint.exits > 0 ? [new Date(shiftIso(startedAt, 34)).getTime()] : [],
      first_interaction_at: shiftIso(startedAt, 1),
      last_interaction_at: shiftIso(endedAt, -2),
      intention: blockLabel,
      next_step: blueprint.blockType === "admin" ? "definir el siguiente pendiente" : "dejar el siguiente paso escrito",
      minimum_viable: blueprint.blockType === "admin" ? "cerrar al menos un frente" : "terminar una parte visible",
      energy_before: blueprint.blockType === "admin" ? 2 : 4,
      mood_before: blueprint.blockType === "admin" ? 2 : 4,
      mood_after: blueprint.blockType === "admin" ? 2 : 4,
      progress_feeling_after: clamp(Math.round((blueprint.progress / 25)), 2, 5),
      difficulty: blueprint.difficulty,
      clarity: blueprint.clarity,
      start_delay_ms: blueprint.startDelayMin * 60 * 1000,
      previous_context: blueprint.blockType === "admin" ? "context switching" : "planned start",
      session_quality_score: blueprint.behavior,
      active_layer: null,
      history: [
        "demo seed",
        blueprint.blockType === "admin" ? "high-friction context" : "stable context",
      ],
      card_memory: {},
      closure_bridge_shown: blueprint.blockType !== "admin",
      closure_note: blueprint.blockType === "admin"
        ? { text: "Costó sostener el bloque en este contexto.", timestamp: new Date(endedAt).getTime() }
        : { text: "Sesión consistente con buen cierre.", timestamp: new Date(endedAt).getTime() },
      entry_ritual: {
        isActive: false,
        completed: true,
        skipped: false,
        objective: blockLabel,
        nextStep: "empezar por el tramo más claro",
        minimumViable: "dejar una parte cerrada",
        suggestedStartMode: "normal",
        selectedStartMode: "normal",
        startedAt: new Date(initiatedAt).getTime(),
        completedAt: new Date(startedAt).getTime(),
      },
      updated_at: endedAt,
    });

    analytics.push({
      session_id: sessionId,
      user_id: userId,
      mode: "block",
      block_type: blueprint.blockType,
      time_window: resolveFocusWindow(blueprint.hour),
      duration_bucket: resolveDurationBucket(blueprint.durationMin),
      initiated_at: initiatedAt,
      started_at: startedAt,
      ended_at: endedAt,
      entry_duration_ms: 2 * 60 * 1000,
      planned_duration_ms: plannedDurationMs,
      actual_duration_ms: actualDurationMs,
      active_duration_ms: activeDurationMs,
      pause_duration_ms: pauseDurationMs,
      inactivity_duration_ms: inactivityDurationMs,
      pause_count: blueprint.pauses,
      exit_count: blueprint.exits,
      task_change_count: blueprint.blockType === "admin" ? 1 : 0,
      intervention_count: blueprint.interventions.length,
      intervention_accept_count: blueprint.interventions.filter((item) => item.result === "accepted").length,
      intervention_ignore_count: blueprint.interventions.filter((item) => item.result !== "accepted").length,
      inactivity_count: blueprint.inactivityCount,
      stability_recovery_count: blueprint.recovery >= 0.5 && blueprint.inactivityCount > 0 ? 1 : 0,
      closure_type: blueprint.closureType,
      completion_ratio: round(blueprint.completion),
      stability_ratio: round(blueprint.stability),
      continuity_ratio: round(blueprint.continuity),
      recovery_ratio: round(blueprint.recovery),
      start_delay_ms: blueprint.startDelayMin * 60 * 1000,
      progress_score: blueprint.progress,
      friction_score: blueprint.friction,
      consistency_score: blueprint.consistency,
      behavior_score: blueprint.behavior,
      diagnostics: {
        entryDurationMs: 2 * 60 * 1000,
        completionRatio: round(blueprint.completion),
        timeWindow: resolveFocusWindow(blueprint.hour),
        durationBucket: resolveDurationBucket(blueprint.durationMin),
        frictionEvents: blueprint.pauses + blueprint.exits + blueprint.inactivityCount,
        stabilityRecoveryCount: blueprint.recovery >= 0.5 && blueprint.inactivityCount > 0 ? 1 : 0,
        interruptionPenalty: round(blueprint.pauses * 0.08),
        inactivityPenalty: round(blueprint.inactivityCount > 0 ? 0.16 : 0),
        recoveryBonus: round(blueprint.recovery * 0.12),
        scoreBreakdown: {
          progress: blueprint.progress,
          friction: blueprint.friction,
          consistency: blueprint.consistency,
          behavior: blueprint.behavior,
        },
      },
      computed_at: endedAt,
      updated_at: endedAt,
    });

    events.push({
      id: `${sessionId}-started`,
      user_id: userId,
      session_id: sessionId,
      event_type: "session_started",
      runtime_state: "entry",
      occurred_at: initiatedAt,
      relative_ms: 0,
      payload: { source: "demo_seed" },
    });

    events.push({
      id: `${sessionId}-entry`,
      user_id: userId,
      session_id: sessionId,
      event_type: "entry_completed",
      runtime_state: "active",
      occurred_at: startedAt,
      relative_ms: 2 * 60 * 1000,
      payload: { selectedStartMode: "normal" },
    });

    events.push({
      id: `${sessionId}-interaction`,
      user_id: userId,
      session_id: sessionId,
      event_type: "session_interaction",
      runtime_state: "active",
      occurred_at: shiftIso(startedAt, 4),
      relative_ms: 6 * 60 * 1000,
      payload: { source: "demo_seed" },
    });

    if (blueprint.inactivityCount > 0) {
      events.push({
        id: `${sessionId}-inactivity`,
        user_id: userId,
        session_id: sessionId,
        event_type: "inactivity_detected",
        runtime_state: "friction_detected",
        occurred_at: shiftIso(startedAt, 28),
        relative_ms: 30 * 60 * 1000,
        payload: { source: "demo_seed_idle" },
      });

      events.push({
        id: `${sessionId}-recovered`,
        user_id: userId,
        session_id: sessionId,
        event_type: "stability_recovered",
        runtime_state: "stabilized",
        occurred_at: shiftIso(startedAt, 42),
        relative_ms: 44 * 60 * 1000,
        payload: { source: "demo_seed_activity" },
      });
    }

    blueprint.interventions.forEach((intervention, interventionIndex) => {
      const shownAt = shiftIso(startedAt, 26 + interventionIndex);
      events.push({
        id: `${sessionId}-intervention-shown-${interventionIndex}`,
        user_id: userId,
        session_id: sessionId,
        event_type: "intervention_shown",
        runtime_state: "intervention",
        occurred_at: shownAt,
        relative_ms: (28 + interventionIndex) * 60 * 1000,
        payload: { kind: intervention.type },
      });

      events.push({
        id: `${sessionId}-intervention-outcome-${interventionIndex}`,
        user_id: userId,
        session_id: sessionId,
        event_type: intervention.result === "accepted" ? "intervention_accepted" : "intervention_ignored",
        runtime_state: intervention.result === "accepted" ? "stabilized" : "friction_detected",
        occurred_at: shiftIso(shownAt, 2),
        relative_ms: (30 + interventionIndex) * 60 * 1000,
        payload: { kind: intervention.type, result: intervention.result },
      });

      interventions.push({
        id: `${sessionId}-intervention-${interventionIndex}`,
        user_id: userId,
        session_id: sessionId,
        occurred_at: shownAt,
        type: intervention.type,
        source_card: "demo_seed_card",
        source_toast: null,
        trigger: "demo_seed",
        action_taken: intervention.actionTaken,
        result: intervention.result,
        payload: { seeded: true },
      });
    });

    events.push({
      id: `${sessionId}-completed`,
      user_id: userId,
      session_id: sessionId,
      event_type: "session_completed",
      runtime_state: blueprint.closureType === "completed" ? "completed" : "abandoned",
      occurred_at: endedAt,
      relative_ms: (blueprint.durationMin + 2) * 60 * 1000,
      payload: { closureType: blueprint.closureType },
    });
  });

  return { sessions, analytics, events, interventions };
}

function buildDailyMetricsFromAnalytics(userId, analyticsRows) {
  const grouped = new Map();

  for (const row of analyticsRows) {
    const date = row.ended_at.slice(0, 10);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(row);
  }

  const metrics = [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, rows]) => {
      const average = (field) => rows.reduce((total, item) => total + Number(item[field] ?? 0), 0) / rows.length;
      const progressScore = Math.round(average("progress_score"));
      const frictionScore = Math.round(average("friction_score"));
      const consistencyScore = Math.round(average("consistency_score"));
      const behaviorScore = Math.round(average("behavior_score"));
      const momentumDay = calculateMomentumDay(progressScore, consistencyScore, frictionScore, behaviorScore);

      return {
        id: randomUUID(),
        user_id: userId,
        date,
        progress_score: progressScore,
        friction_score: frictionScore,
        consistency_score: consistencyScore,
        emotion_score: behaviorScore,
        behavior_score: behaviorScore,
        momentum_day: momentumDay,
        momentum_total: 0,
        session_count: rows.length,
        completed_sessions: rows.filter((row) => row.closure_type === "completed").length,
        abandoned_sessions: rows.filter((row) => row.closure_type === "abandoned").length,
        active_duration_ms: rows.reduce((total, row) => total + row.active_duration_ms, 0),
        pause_duration_ms: rows.reduce((total, row) => total + row.pause_duration_ms, 0),
        inactivity_duration_ms: rows.reduce((total, row) => total + row.inactivity_duration_ms, 0),
        created_at: `${date}T08:00:00.000Z`,
        updated_at: `${date}T22:00:00.000Z`,
      };
    });

  const history = [];
  for (const metric of metrics) {
    history.push({ date: metric.date, momentum_day: metric.momentum_day });
    metric.momentum_total = calculateMomentumTotal(history);
  }

  return metrics;
}

async function ensureDemoUser(supabase) {
  const { data: userPage, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listError) throw listError;

  const existing = userPage.users.find((user) => user.email === DEMO_EMAIL);
  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        username: DEMO_USERNAME,
        full_name: DEMO_FULL_NAME,
      },
    });

    if (updateError) throw updateError;
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      username: DEMO_USERNAME,
      full_name: DEMO_FULL_NAME,
    },
  });

  if (error) throw error;
  return data.user.id;
}

async function resetDemoData(supabase, userId) {
  const deletions = [
    supabase.from("behavior_pattern_history").delete().eq("user_id", userId),
    supabase.from("user_behavior_profile").delete().eq("user_id", userId),
    supabase.from("daily_metrics").delete().eq("user_id", userId),
    supabase.from("focus_sessions").delete().eq("user_id", userId),
    supabase.from("blocks").delete().eq("user_id", userId),
  ];

  const results = await Promise.all(deletions);
  for (const result of results) {
    if (result.error) throw result.error;
  }
}

async function seed() {
  loadEnvFile();

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = requireEnv("PERSONAL_INTELLIGENCE_CRON_SECRET");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const userId = await ensureDemoUser(supabase);
  await resetDemoData(supabase, userId);

  const { sessions, analytics, events, interventions } = buildSeedRows(userId);
  const dailyMetrics = buildDailyMetricsFromAnalytics(userId, analytics);

  const profilePayload = {
    id: userId,
    username: DEMO_USERNAME,
    full_name: DEMO_FULL_NAME,
    updated_at: new Date().toISOString(),
    preferences: {
      demo_seed: true,
      seeded_at: new Date().toISOString(),
    },
  };

  const profileResult = await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
  if (profileResult.error) throw profileResult.error;

  const sessionsResult = await supabase.from("focus_sessions").insert(sessions);
  if (sessionsResult.error) throw sessionsResult.error;

  const eventsResult = await supabase.from("focus_session_events").insert(events);
  if (eventsResult.error) throw eventsResult.error;

  if (interventions.length > 0) {
    const interventionsResult = await supabase.from("focus_session_interventions").insert(interventions);
    if (interventionsResult.error) throw interventionsResult.error;
  }

  const analyticsResult = await supabase.from("focus_session_analytics").insert(analytics);
  if (analyticsResult.error) throw analyticsResult.error;

  const metricsResult = await supabase.from("daily_metrics").upsert(dailyMetrics, { onConflict: "user_id,date" });
  if (metricsResult.error) throw metricsResult.error;

  for (const scope of ["daily", "weekly"]) {
    const response = await fetch(`${DEMO_APP_BASE_URL}/api/analytics/consolidate/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agendo-cron-secret": cronSecret,
      },
      body: JSON.stringify({
        scope,
        userIds: [userId],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Consolidation failed for ${scope}: ${response.status} ${body}`);
    }
  }

  const [{ count: analyticsCount, error: analyticsError }, { data: profileRows, error: profileError }, { count: metricsCount, error: metricsError }] = await Promise.all([
    supabase.from("focus_session_analytics").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("user_behavior_profile").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("daily_metrics").select("*", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  if (analyticsError) throw analyticsError;
  if (profileError) throw profileError;
  if (metricsError) throw metricsError;

  console.log(JSON.stringify({
    status: "seeded",
    email: DEMO_EMAIL,
    username: DEMO_USERNAME,
    password: DEMO_PASSWORD,
    userId,
    analyticsCount,
    metricsCount,
    profileWarmupStage: profileRows?.warmup_stage ?? null,
    activePatternCount: Array.isArray(profileRows?.active_patterns) ? profileRows.active_patterns.length : null,
  }, null, 2));
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
