/**
 * Lightweight application metrics for Prometheus scraping (Issue #195).
 * No external dependencies — outputs Prometheus text format directly.
 *
 * Counters persist in-memory per Node.js worker; resets on deploy.
 * For durable metrics, use a proper time-series DB.
 */

interface Metrics {
  httpRequestsTotal: Record<string, number>;
  httpErrorsTotal: Record<string, number>;
  httpDurationSum: Record<string, number>;
  httpDurationCount: Record<string, number>;
}

const metrics: Metrics = {
  httpRequestsTotal: {},
  httpErrorsTotal: {},
  httpDurationSum: {},
  httpDurationCount: {},
};

/** Record a completed HTTP request. */
export function recordRequest(method: string, path: string, status: number, durationMs: number) {
  const route = normalizeRoute(path);
  const key = `${method}|${route}|${status}`;

  metrics.httpRequestsTotal[key] = (metrics.httpRequestsTotal[key] ?? 0) + 1;

  if (status >= 400) {
    metrics.httpErrorsTotal[key] = (metrics.httpErrorsTotal[key] ?? 0) + 1;
  }

  const durKey = `${method}|${route}`;
  metrics.httpDurationSum[durKey] = (metrics.httpDurationSum[durKey] ?? 0) + durationMs;
  metrics.httpDurationCount[durKey] = (metrics.httpDurationCount[durKey] ?? 0) + 1;
}

/** Normalize dynamic route segments to reduce cardinality. */
function normalizeRoute(path: string): string {
  return path
    .replace(/\/[a-z0-9]{20,}/gi, "/:id") // cuid/uuid segments
    .replace(/\/\d+/g, "/:id");            // numeric IDs
}

/** Serialize all metrics in Prometheus text exposition format. */
export function serializeMetrics(): string {
  const lines: string[] = [];

  // http_requests_total
  lines.push("# HELP titan_http_requests_total Total HTTP requests");
  lines.push("# TYPE titan_http_requests_total counter");
  for (const [key, count] of Object.entries(metrics.httpRequestsTotal)) {
    const [method, route, status] = key.split("|");
    lines.push(`titan_http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
  }

  // http_errors_total
  lines.push("# HELP titan_http_errors_total Total HTTP errors (4xx/5xx)");
  lines.push("# TYPE titan_http_errors_total counter");
  for (const [key, count] of Object.entries(metrics.httpErrorsTotal)) {
    const [method, route, status] = key.split("|");
    lines.push(`titan_http_errors_total{method="${method}",route="${route}",status="${status}"} ${count}`);
  }

  // http_request_duration_ms (sum + count for computing average)
  lines.push("# HELP titan_http_request_duration_ms_sum Sum of HTTP request durations in ms");
  lines.push("# TYPE titan_http_request_duration_ms_sum counter");
  for (const [key, sum] of Object.entries(metrics.httpDurationSum)) {
    const [method, route] = key.split("|");
    lines.push(`titan_http_request_duration_ms_sum{method="${method}",route="${route}"} ${sum.toFixed(2)}`);
  }
  lines.push("# HELP titan_http_request_duration_ms_count Count of HTTP requests for duration");
  lines.push("# TYPE titan_http_request_duration_ms_count counter");
  for (const [key, count] of Object.entries(metrics.httpDurationCount)) {
    const [method, route] = key.split("|");
    lines.push(`titan_http_request_duration_ms_count{method="${method}",route="${route}"} ${count}`);
  }

  // uptime
  lines.push("# HELP titan_uptime_seconds Process uptime in seconds");
  lines.push("# TYPE titan_uptime_seconds gauge");
  lines.push(`titan_uptime_seconds ${(process.uptime?.() ?? 0).toFixed(0)}`);

  return lines.join("\n") + "\n";
}
