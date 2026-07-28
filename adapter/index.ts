/**
 * Memsy Provider for MemoryBench
 *
 * This provider connects MemoryBench to the hosted Memsy API at
 * https://api.memsy.io/v1. No local server setup required.
 *
 * Required environment variables:
 *   MEMSY_API_KEY   — your Memsy API key (get one at https://app.memsy.io)
 *   MEMSY_API_URL   — optional override (default: https://api.memsy.io/v1)
 *
 * IMPORTANT – Avoid duplicate events:
 * - Run the benchmark from THIS repo: cd memsy/memorybench && bun run src/index.ts run ...
 * - This provider sends one event PER MESSAGE, matching production usage where each message
 *   turn is its own event. This enables the extraction context window to see real prior turns
 *   and makes include_source_events return individual messages rather than session blobs.
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
 * Translate a UnifiedSession into one MemsyEventPayload PER MESSAGE.
 *
 * Each message turn becomes its own event, matching production usage where
 * the client sends one event per turn. This allows the extraction context
 * window to see real prior turns (same session_id) and makes
 * include_source_events return individual messages rather than blobs.
 *
 * actor_id is the conversation-level ID so all sessions from the same
 * conversation share one actor scope, eliminating cross-conversation noise.
 *
 * Timestamps are synthetic: session date + 1 second per message index.
 */
function sessionToMessages(
  session: UnifiedSession,
  orgId: string,
): MemsyEventPayload[] {
  const rawDate =
    (session.metadata?.date as string | undefined) ?? new Date().toISOString();
  const baseTs = new Date(rawDate).getTime();
  const sessionId = session.sessionId ?? "";
  const convId = conversationIdFromSessionId(sessionId);

  type ImageEntry = { blip_caption: string; speaker: string } | null;
  const messageImages =
    (session.metadata?.message_images as ImageEntry[] | undefined) ?? [];

  const meta: Record<string, string> = {};
  if (session.metadata?.speakerA)
    meta.speaker_a = session.metadata.speakerA as string;
  if (session.metadata?.speakerB)
    meta.speaker_b = session.metadata.speakerB as string;
  const metadata =
    Object.keys(meta).length > 0 ? JSON.stringify(meta) : undefined;

  return session.messages.map((msg: UnifiedMessage, idx: number) => {
    const imgData = messageImages[idx];
    const imgPrefix = imgData?.blip_caption
      ? `[${msg.speaker ?? imgData.speaker} shared an image: ${imgData.blip_caption}] `
      : "";
    const speakerName =
      msg.speaker ??
      (msg.role === "user"
        ? "User"
        : msg.role === "assistant"
          ? "Assistant"
          : "System");
    const content = `${speakerName}: ${imgPrefix}${msg.content}`;
    const ts = new Date(baseTs + idx * 1000).toISOString();
    const kind: "user_message" | "assistant_message" | "app_event" =
      msg.role === "user"
        ? "user_message"
        : msg.role === "assistant"
          ? "assistant_message"
          : "app_event";
    return {
      actor_id: convId,
      session_id: sessionId,
      kind,
      content,
      ts,
      event_id: deterministicEventId(orgId, sessionId, ts, content),
      ...(metadata !== undefined ? { metadata } : {}),
    };
  });
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
  private apiKey: string = "";
  /** Event IDs we've already sent this run; skip them on subsequent ingest calls. */
  private sentEventIds = new Set<string>();
  /** Run graph conflict-detection once per conversation after indexing (A/B flag). */
  private detectConflicts = false;
  /** Conversations already conflict-detected this run (once per conversation). */
  private conflictsRun = new Set<string>();
  /** Attach raw source-event transcripts to search results. Off = lean context
   * (memory text only) → far fewer tokens. Set MEMSY_BENCH_SOURCE_EVENTS=false. */
  private sourceEvents = true;
  /** Arm 3 (never-flip): ask the API to attach each survivor's superseded
   * predecessors as read-time annotations instead of silently hiding them.
   * Presupposes arm 2 — annotations only exist where supersedes edges do — so
   * it is only meaningful with MEMSY_BENCH_DETECT_CONFLICTS=true. Purely
   * additive at read time: never changes WHICH memories come back, only what
   * the answer prompt is told about them. Set
   * MEMSY_BENCH_SUPERSEDED_ANNOTATIONS=true. */
  private supersededAnnotations = false;

  async initialize(config: ProviderConfig): Promise<void> {
    this.baseUrl =
      config.baseUrl || process.env.MEMSY_API_URL || "https://api.memsy.io/v1";
    this.apiKey = config.apiKey || process.env.MEMSY_API_KEY || "";
    this.detectConflicts = process.env.MEMSY_BENCH_DETECT_CONFLICTS === "true";
    this.sourceEvents = process.env.MEMSY_BENCH_SOURCE_EVENTS !== "false";
    this.supersededAnnotations =
      process.env.MEMSY_BENCH_SUPERSEDED_ANNOTATIONS === "true";

    if (!this.apiKey) {
      throw new Error(
        "Memsy provider requires an API key. Set MEMSY_API_KEY in your environment or .env file.",
      );
    }

    // Log the PARSED values, not the raw env. A silently-unread flag is the
    // failure mode that makes an arm look like a null result rather than a
    // misconfiguration.
    logger.info(
      `Memsy arm config: detectConflicts=${this.detectConflicts} ` +
        `sourceEvents=${this.sourceEvents} supersededAnnotations=${this.supersededAnnotations}`,
    );
    if (this.supersededAnnotations && !this.detectConflicts) {
      logger.warn(
        "MEMSY_BENCH_SUPERSEDED_ANNOTATIONS=true but MEMSY_BENCH_DETECT_CONFLICTS is not true — " +
          "no supersedes edges will exist, so arm 3 will be indistinguishable from arm 1.",
      );
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
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

  /**
   * Produce supersedes/contradicts/related graph edges for a conversation and
   * mark the older memory of each supersedes pair `superseded` (retrieval then
   * excludes it, since arm 3's annotation flag defaults to false). Runs once
   * per conversation, best-effort — a failure never fails the benchmark.
   * Gated by MEMSY_BENCH_DETECT_CONFLICTS=true so runs can be A/B compared.
   * `/detect-conflicts` runs the on-demand ActorCandidateSource path (exhaustive
   * band pairs for one actor), not the scheduled worker's below-band entity
   * source — so this measures band-source conflicts specifically.
   */
  private async runConflictDetection(containerTag: string): Promise<void> {
    if (!this.detectConflicts) return;
    const convId = conversationIdFromContainerTag(containerTag);
    if (this.conflictsRun.has(convId)) return;
    this.conflictsRun.add(convId);
    try {
      const res = await fetch(`${this.baseUrl}/detect-conflicts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ actor_id: convId }),
      });
      if (!res.ok) {
        logger.warn(`detect-conflicts failed for ${convId}: ${res.status}`);
        return;
      }
      const d = (await res.json()) as {
        supersedes: number;
        contradicts: number;
        opinion: number;
        superseded_marked: number;
      };
      logger.info(
        `detect-conflicts ${convId}: supersedes=${d.supersedes} contradicts=${d.contradicts} ` +
          `opinion=${d.opinion} superseded=${d.superseded_marked}`,
      );
    } catch (e) {
      logger.warn(`detect-conflicts error for ${convId}: ${e}`);
    }
  }

  async ingest(
    sessions: UnifiedSession[],
    options: IngestOptions,
  ): Promise<IngestResult> {
    const orgId = getRunScopedOrgId(options.containerTag);

    // One event per message (production model)
    const allEvents: MemsyEventPayload[] = sessions.flatMap((session) =>
      sessionToMessages(session, orgId),
    );

    // Deduplicate: skip message events already sent this run
    const events = allEvents.filter((e) => {
      const id =
        e.event_id ??
        deterministicEventId(orgId, e.session_id ?? "", e.ts, e.content);
      if (this.sentEventIds.has(id)) return false;
      this.sentEventIds.add(id);
      return true;
    });

    if (events.length === 0) {
      logger.debug(
        `Ingest skipped ${allEvents.length} already-sent message events`,
      );
      return { documentIds: [] };
    }

    const requestBody: MemsyIngestRequest = { events };

    const response = await fetch(`${this.baseUrl}/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `Ingest failed: ${response.status} ${await response.text()}`,
      );
    }

    const data = (await response.json()) as MemsyIngestResponse;
    logger.debug(
      `Ingested ${data.event_ids.length} message events from ${sessions.length} sessions`,
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
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
        await this.runConflictDetection(containerTag);
        return;
      }

      await new Promise((r) => setTimeout(r, backoffMs));
      backoffMs = Math.min(backoffMs * 1.2, 5000);
    }
  }

  async search(query: string, options: SearchOptions): Promise<unknown[]> {
    const convId = conversationIdFromContainerTag(options.containerTag);

    const response = await fetch(`${this.baseUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query,
        actor_id: convId,
        limit: options.limit ?? 10,
        threshold: options.threshold || 0.3,
        include_source_events: this.sourceEvents,
        include_superseded_annotations: this.supersededAnnotations,
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
        headers: { Authorization: `Bearer ${this.apiKey}` },
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
