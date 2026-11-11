import { desc, eq, sql } from "drizzle-orm";
import { DB_PATH, EXPORT_PATH, WEB_DATA_PATH } from "./config.ts";
import { openDb } from "./db/client.ts";
import { shelters, syncRuns } from "./db/schema.ts";
import { exportGeoJson } from "./export.ts";
import { exportWebData } from "./export-web.ts";
import { enrich } from "./enrich.ts";
import { sync } from "./sync/run.ts";

const command = process.argv[2];
const db = openDb(DB_PATH);

switch (command) {
  case "sync": {
    const s = await sync(db);
    console.log(
      `sync #${s.runId}: fetched ${s.fetched} | +${s.added} added, ~${s.updated} updated, ` +
        `-${s.removed} removed, ${s.restored} restored, ${s.unchanged} unchanged`,
    );
    console.log(`source published at: ${s.sourcePublishedAt?.toISOString() ?? "unknown"}`);
    for (const w of s.warnings) console.warn(`warning: ${w}`);
    if (process.argv.includes("--export")) {
      console.log(`exported ${exportGeoJson(db, EXPORT_PATH)} to ${EXPORT_PATH}`);
      console.log(`exported ${exportWebData(db, WEB_DATA_PATH)} to ${WEB_DATA_PATH}`);
    }
    break;
  }
  case "enrich": {
    const r = await enrich(db);
    console.log(`enrich: ${r.places} OpenStreetMap places with hours, ${r.matched} shelters linked to the institution in their building`);
    break;
  }
  case "export": {
    console.log(`exported ${exportGeoJson(db, EXPORT_PATH)} shelters to ${EXPORT_PATH}`);
    console.log(`exported ${exportWebData(db, WEB_DATA_PATH)} shelters to ${WEB_DATA_PATH}`);
    break;
  }
  case "stats": {
    const active = sql`${shelters.removedAt} is null`;
    const [t] = db
      .select({
        active: sql<number>`sum(${active})`,
        removed: sql<number>`sum(${shelters.removedAt} is not null)`,
        withHours: sql<number>`sum(${active} and ${shelters.hoursRaw} is not null)`,
        open24h: sql<number>`sum(${active} and ${shelters.access24h} = 1)`,
        not24h: sql<number>`sum(${active} and ${shelters.access24h} = 0)`,
        unknown24h: sql<number>`sum(${active} and ${shelters.access24h} is null)`,
        capacity: sql<number>`sum(case when ${active} then ${shelters.capacity} end)`,
      })
      .from(shelters)
      .all();
    console.table(t);
    const runs = db.select().from(syncRuns).orderBy(desc(syncRuns.id)).limit(5).all();
    console.table(
      runs.map((r) => ({
        id: r.id,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        published: r.sourcePublishedAt?.toISOString(),
        fetched: r.fetched,
        added: r.added,
        updated: r.updated,
        removed: r.removed,
        error: r.error?.slice(0, 80),
      })),
    );
    break;
  }
  default:
    console.error("usage: node src/cli.ts <sync [--export] | enrich | export | stats>");
    process.exitCode = 1;
}
