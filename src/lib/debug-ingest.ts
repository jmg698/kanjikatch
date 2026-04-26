/** Cursor debug mode NDJSON ingest (local `next dev` only). */
export function agentDebugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {},
  runId = "extract-pre",
): void {
  // #region agent log
  fetch("http://127.0.0.1:7900/ingest/f6d443fc-81bd-4a2a-96c6-1029ff40c4d4", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "171cc0" },
    body: JSON.stringify({
      sessionId: "171cc0",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
      runId,
    }),
  }).catch(() => {});
  // #endregion
}
