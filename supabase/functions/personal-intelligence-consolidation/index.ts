Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const appBaseUrl = Deno.env.get("APP_BASE_URL");
  const cronSecret = Deno.env.get("PERSONAL_INTELLIGENCE_CRON_SECRET");

  if (!appBaseUrl || !cronSecret) {
    return new Response(JSON.stringify({ error: "Missing consolidation env vars" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({}));
  const scope = body?.scope === "weekly" ? "weekly" : "daily";

  const response = await fetch(`${appBaseUrl.replace(/\/$/, "")}/api/analytics/consolidate/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agendo-cron-secret": cronSecret,
    },
    body: JSON.stringify({ scope }),
  });

  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
});
