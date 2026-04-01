/**
 * Memsy Provider for MemoryBench
 *
 * This provider connects MemoryBench to the local Memsy HTTP API.
 * Requires running the Memsy API server separately.
 *
 * IMPORTANT – Avoid duplicate events:
 * - Run the benchmark from THIS repo: cd memsy/memorybench && bun run src/index.ts run ...
 * - This provider uses run-scoped org_id and sends one event PER SESSION (not per message).
 *   All messages in a session are concatenated into a single content blob so the LLM extractor
 *   sees the full conversation at once, with speaker names already embedded.
 *
 * Usage:
 *   1. Copy this file to: memorybench/src/providers/memsy/index.ts
 *   2. Copy prompts.ts to: memorybench/src/providers/memsy/prompts.ts
 *   3. Register in src/providers/index.ts
 *   4. Add "memsy" to ProviderName type in src/types/provider.ts
 */

import { createHash } from "crypto";
import type {
  Provider,
  ProviderConfig,
  IngestOptions,
  IngestResult,
  SearchOptions,
  IndexingProgressCallback,
} from "../../types/provider";
import type { UnifiedSession, UnifiedMessage } from "../../types/unified";
import { logger } from "../../utils/logger";
import { MEMSY_PROMPTS } from "./prompts";

// ============================================================
// Memsy API wire types
// ============================================================

interface MemsyEventPayload {
  org_id: string;
  actor_id: string;
  session_id?: string;
  kind: "user_message" | "assistant_message" | "app_event";
  content: string;
  ts: string; // ISO 8601
  metadata?: string; // opaque JSON string
  event_id?: string; // optional idempotency key; same session → same id → server skips duplicates
}

interface MemsyIngestRequest {
  events: MemsyEventPayload[];
}

interface MemsyIngestResponse {
  event_ids: string[];
}

interface MemsySearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

interface MemsySearchResponse {
  results: MemsySearchResult[];
}

interface MemsyStatusResponse {
  completedIds: string[];
  failedIds: string[];
  pendingIds: string[];
  total: number;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Org scoped to the conversation so the vector index naturally isolates each
 * conversation's memories without needing actor_id scope filtering (which would
 * require per-conversation overfetch tuning).
 *
 * Format: "org_memorybench_{convId}" e.g. "org_memorybench_conv-26"
 *
 * This ensures that during search, candidates from other conversations are never
 * fetched from the index, eliminating cross-conversation noise while preserving
 * the full candidate pool for reranking and diversity selection.
 */
function getRunScopedOrgId(containerTag: string): string {
  const convId = conversationIdFromContainerTag(containerTag);
  return `org_memorybench_${convId}`;
}

/**
 * Deterministic event_id for idempotency (like Mem0: provider does not send event_id from API;
 * we send a content-derived id so the server can skip duplicates without in-memory state).
 */
function deterministicEventId(
  orgId: string,
  sessionId: string,
  ts: string,
  content: string,
): string {
  const h = createHash("sha256")
    .update(orgId + "\0" + sessionId + "\0" + ts + "\0" + content, "utf8")
    .digest();
  return "ev_" + h.slice(0, 20).toString("hex");
}

/**
 * Extract the conversation-level ID from a session ID.
 * Session IDs follow the pattern "<sample_id>-session_<N>" (e.g. "conv-26-session_4").
 * This strips the "-session_N" suffix to yield the conversation scope (e.g. "conv-26").
 */
function conversationIdFromSessionId(sessionId: string): string {
  return sessionId.replace(/-session_\d+$/, "") || sessionId;
}

/**
 * Extract the conversation-level ID from a containerTag.
 * containerTag = "<questionId>-<runId>" where questionId = "<sample_id>-q<N>".
 * Strip "-q<N>..." to get the sample_id (e.g. "conv-26-q5-abc" → "conv-26").
 */
function conversationIdFromContainerTag(containerTag: string): string {
  return containerTag.replace(/-q\d+.*$/, "") || containerTag;
}

/**
 * Translate a single UnifiedSession into ONE MemsyEventPayload.
 *
 * All messages in the session are concatenated into a single content block
 * so the LLM extractor sees the full conversation at once. Each line is
 * prefixed with the speaker name (if available) so the extractor can
 * attribute facts correctly without needing to read metadata.
 *
 * actor_id is set to the conversation-level ID (not the session ID) so that
 * all sessions from the same conversation share one actor scope. This allows
 * search to be scoped to a single conversation, eliminating cross-conversation
 * retrieval noise.
 *
 * Format per line:
 *   "SpeakerName: message content"   (when speaker is present)
 *   "message content"                (when no speaker info)
 */
function sessionToEvent(
  session: UnifiedSession,
  orgId: string,
): MemsyEventPayload {
  const rawDate =
    (session.metadata?.date as string | undefined) ?? new Date().toISOString();
  const sessionId = session.sessionId ?? "";
  const convId = conversationIdFromSessionId(sessionId);

  // Per-message image captions: session.metadata.message_images is an optional array
  // (one entry per message, null when no image) populated by the LoCoMo data pipeline.
  type ImageEntry = { blip_caption: string; speaker: string } | null;
  const messageImages =
    (session.metadata?.message_images as ImageEntry[] | undefined) ?? [];

  // Build one content string: each message on its own line, speaker-prefixed.
  // If a message has an image caption, prepend it so the LLM extractor sees it.
  const lines = session.messages.map((msg: UnifiedMessage, idx: number) => {
    const imgData = messageImages[idx];
    const imgPrefix = imgData?.blip_caption
      ? `[${msg.speaker ?? imgData.speaker} shared an image: ${imgData.blip_caption}] `
      : "";
    const content = `${imgPrefix}${msg.content}`;
    if (msg.speaker) {
      return `${msg.speaker}: ${content}`;
    }
    // Fall back to role label when no explicit speaker name
    const label =
      msg.role === "user"
        ? "User"
        : msg.role === "assistant"
          ? "Assistant"
          : "System";
    return `${label}: ${content}`;
  });
  const content = lines.join("\n");

  // Carry session-level speaker metadata for downstream use
  const meta: Record<string, string> = {};
  if (session.metadata?.speakerA)
    meta.speaker_a = session.metadata.speakerA as string;
  if (session.metadata?.speakerB)
    meta.speaker_b = session.metadata.speakerB as string;
  const metadata =
    Object.keys(meta).length > 0 ? JSON.stringify(meta) : undefined;

  return {
    org_id: orgId,
    actor_id: convId, // conversation-scoped, not session-scoped
    session_id: sessionId, // keep original session_id for provenance
    kind: "user_message",
    content,
    ts: rawDate,
    event_id: deterministicEventId(orgId, sessionId, rawDate, content),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

// ============================================================
// Provider
// ============================================================

export class MemsyProvider implements Provider {
  name = "memsy";
  prompts = MEMSY_PROMPTS;
  concurrency = {
    default: 50,
    search: 10,
  };
  private baseUrl: string = "";
  /** Event IDs we've already sent this run; skip them on subsequent ingest calls. */
  private sentEventIds = new Set<string>();

  async initialize(config: ProviderConfig): Promise<void> {
    this.baseUrl =
      config.baseUrl || process.env.MEMSY_API_URL || "http://localhost:8003";

    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      logger.info(`Initialized Memsy provider at ${this.baseUrl}`);
    } catch (e) {
      throw new Error(
        `Failed to connect to Memsy API at ${this.baseUrl}: ${e}`,
      );
    }
  }

  async ingest(
    sessions: UnifiedSession[],
    options: IngestOptions,
  ): Promise<IngestResult> {
    const orgId = getRunScopedOrgId(options.containerTag);

    // One event per session (not per message)
    const allEvents: MemsyEventPayload[] = sessions.map((session) =>
      sessionToEvent(session, orgId),
    );

    // Deduplicate: skip sessions already sent this run
    const events = allEvents.filter((e) => {
      const id =
        e.event_id ??
        deterministicEventId(orgId, e.session_id ?? "", e.ts, e.content);
      if (this.sentEventIds.has(id)) return false;
      this.sentEventIds.add(id);
      return true;
    });

    if (events.length === 0) {
      logger.debug(`Ingest skipped ${allEvents.length} already-sent sessions`);
      return { documentIds: [] };
    }

    const requestBody: MemsyIngestRequest = { events };

    const response = await fetch(`${this.baseUrl}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `Ingest failed: ${response.status} ${await response.text()}`,
      );
    }

    const data = (await response.json()) as MemsyIngestResponse;
    logger.debug(
      `Ingested ${data.event_ids.length} session events from ${sessions.length} sessions`,
    );

    return { documentIds: data.event_ids };
  }

  async awaitIndexing(
    result: IngestResult,
    containerTag: string,
    onProgress?: IndexingProgressCallback,
  ): Promise<void> {
    if (result.documentIds.length === 0) {
      onProgress?.({ completedIds: [], failedIds: [], total: 0 });
      return;
    }

    const total = result.documentIds.length;
    let backoffMs = 1000;

    onProgress?.({ completedIds: [], failedIds: [], total });

    while (true) {
      const response = await fetch(`${this.baseUrl}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_ids: result.documentIds,
          containerTag,
        }),
      });

      if (!response.ok) {
        logger.warn(`Status check failed: ${response.status}`);
        await new Promise((r) => setTimeout(r, backoffMs));
        backoffMs = Math.min(backoffMs * 1.5, 10000);
        continue;
      }

      const status = (await response.json()) as MemsyStatusResponse;

      onProgress?.({
        completedIds: status.completedIds,
        failedIds: status.failedIds,
        total,
      });

      if (status.pendingIds.length === 0) {
        if (status.failedIds.length > 0) {
          logger.warn(`${status.failedIds.length} documents failed indexing`);
        }
        return;
      }

      await new Promise((r) => setTimeout(r, backoffMs));
      backoffMs = Math.min(backoffMs * 1.2, 5000);
    }
  }

  async search(query: string, options: SearchOptions): Promise<unknown[]> {
    const orgId = getRunScopedOrgId(options.containerTag);

    const response = await fetch(`${this.baseUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        org_id: orgId,
        limit: options.limit ? options.limit * 1 : 10,
        threshold: options.threshold || 0.3,
        include_source_events: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = (await response.json()) as MemsySearchResponse;
    return data.results;
  }

  async clear(containerTag: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/clear/${encodeURIComponent(containerTag)}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      logger.warn(`Clear failed: ${response.status}`);
      return;
    }

    logger.info(`Cleared memories for container: ${containerTag}`);
  }
}

export default MemsyProvider;
