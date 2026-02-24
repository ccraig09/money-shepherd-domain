import { APP_STATE_VERSION } from "../appState";

export type Migration = {
  fromVersion: number;
  toVersion: number;
  migrate: (state: any) => any;
};

/**
 * Ordered list of migrations. Each takes a raw state at `fromVersion`
 * and returns it at `toVersion`. Add new entries as the schema evolves.
 *
 * Example for a future V1 → V2 migration:
 *   { fromVersion: 1, toVersion: 2, migrate: v1ToV2 }
 */
export const migrations: Migration[] = [
  // No migrations yet — V1 is the only version.
  // When V2 is introduced, add: { fromVersion: 1, toVersion: 2, migrate: v1ToV2 }
];

/**
 * Run all applicable migrations on a raw parsed state object.
 * - Missing `version` field defaults to 1 (earliest known version).
 * - Applies migrations in order until state reaches APP_STATE_VERSION.
 * - Returns the migrated state (or the original if already current).
 */
export function runMigrations(raw: any): any {
  let state = { ...raw };

  if (typeof state.version !== "number") {
    state.version = 1;
  }

  for (const m of migrations) {
    if (state.version === m.fromVersion) {
      state = m.migrate(state);
      state.version = m.toVersion;
    }
  }

  if (state.version !== APP_STATE_VERSION) {
    console.warn(
      `[migrations] State version ${state.version} does not match app version ${APP_STATE_VERSION}. ` +
      `Migrations may be missing.`,
    );
  }

  return state;
}
