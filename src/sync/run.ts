import { eq, isNull, sql } from "drizzle-orm";
import { MIN_ACTIVE_RATIO } from "../config.ts";
import type { Db } from "../db/client.ts";
import { type FieldDiff, shelterChanges, shelters, syncRuns } from "../db/schema.ts";
import { fetchAllShelters, type FetchResult } from "../source/arcgis.ts";
import { CONTENT_FIELDS, comparable, normalize, type ShelterRecord } from "../source/normalize.ts";
import { matchShelters } from "./match.ts";

export interface SyncSummary {
  runId: number;
  fetched: number;
  added: number;
  updated: number;
  removed: number;
  restored: number;
  unchanged: number;
  sourcePublishedAt: Date | null;
  warnings: string[];
}

function diff(before: Record<string, unknown>, after: ShelterRecord): FieldDiff {
  const out: FieldDiff = {};
  for (const k of CONTENT_FIELDS) {
    const from = comparable(before[k]);
    const to = comparable(after[k]);
    if (from !== to) out[k] = { from, to };
  }
  return out;
}

export async function sync(
  db: Db,
  opts: { fetch?: () => Promise<FetchResult>; now?: Date } = {},
): Promise<SyncSummary> {
  const now = opts.now ?? new Date();
  const [run] = db.insert(syncRuns).values({ startedAt: now, status: "running" }).returning().all();
  if (!run) throw new Error("Could not create sync run");

  try {
    const fetched = await (opts.fetch ?? (() => fetchAllShelters()))();
    const warnings: string[] = [];
    if (fetched.unknownFields.length) warnings.push(`Source has new fields: ${fetched.unknownFields.join(", ")}`);
    if (fetched.missingFields.length) warnings.push(`Source is missing fields: ${fetched.missingFields.join(", ")}`);

    const incoming = fetched.features.map(normalize);
    const sourcePublishedAt =
      incoming.reduce<Date | null>(
        (max, r) => (r.sourcePublishedAt && (!max || r.sourcePublishedAt > max) ? r.sourcePublishedAt : max),
        null,
      ) ?? null;

    const all = db.select().from(shelters).all();
    const activeCount = all.filter((s) => !s.removedAt).length;
    if (activeCount > 0 && incoming.length < activeCount * MIN_ACTIVE_RATIO) {
      throw new Error(
        `Source returned ${incoming.length} shelters but ${activeCount} are active; ` +
          `below the ${MIN_ACTIVE_RATIO * 100}% safety threshold, refusing to apply`,
      );
    }

    const byId = new Map(all.map((s) => [s.id, s]));
    const { matched, added, unmatched } = matchShelters(
      all.map((s) => ({ ...s, active: !s.removedAt })),
      incoming,
    );

    const summary: SyncSummary = {
      runId: run.id,
      fetched: incoming.length,
      added: 0,
      updated: 0,
      removed: 0,
      restored: 0,
      unchanged: 0,
      sourcePublishedAt,
      warnings,
    };

    db.transaction((tx) => {
      const log = (shelterId: number, kind: "added" | "updated" | "removed" | "restored", d?: FieldDiff) =>
        tx.insert(shelterChanges).values({ shelterId, syncRunId: run.id, kind, diff: d ?? null, at: now }).run();

      for (const { existing, incoming: r } of matched) {
        const prev = byId.get(existing.id)!;
        const changes = prev.fingerprint === r.fingerprint ? {} : diff(prev, r);
        tx.update(shelters)
          .set({ ...r, lastSeenAt: now, removedAt: null })
          .where(eq(shelters.id, existing.id))
          .run();
        if (prev.removedAt) {
          summary.restored++;
          log(existing.id, "restored", Object.keys(changes).length ? changes : undefined);
        } else if (Object.keys(changes).length) {
          summary.updated++;
          log(existing.id, "updated", changes);
        } else summary.unchanged++;
      }

      for (const r of added) {
        const [row] = tx
          .insert(shelters)
          .values({ ...r, firstSeenAt: now, lastSeenAt: now })
          .returning({ id: shelters.id })
          .all();
        summary.added++;
        log(row!.id, "added");
      }

      for (const e of unmatched) {
        if (!e.active) continue;
        tx.update(shelters).set({ removedAt: now }).where(eq(shelters.id, e.id)).run();
        summary.removed++;
        log(e.id, "removed");
      }

      tx.update(syncRuns)
        .set({
          status: "ok",
          finishedAt: new Date(),
          sourcePublishedAt,
          fetched: summary.fetched,
          added: summary.added,
          updated: summary.updated,
          removed: summary.removed,
          restored: summary.restored,
          unchanged: summary.unchanged,
          error: warnings.length ? warnings.join("\n") : null,
        })
        .where(eq(syncRuns.id, run.id))
        .run();
    });

    return summary;
  } catch (err) {
    db.update(syncRuns)
      .set({ status: "failed", finishedAt: new Date(), error: err instanceof Error ? err.message : String(err) })
      .where(eq(syncRuns.id, run.id))
      .run();
    throw err;
  }
}

export function activeShelters(db: Db) {
  return db.select().from(shelters).where(isNull(shelters.removedAt)).orderBy(sql`${shelters.id}`).all();
}
