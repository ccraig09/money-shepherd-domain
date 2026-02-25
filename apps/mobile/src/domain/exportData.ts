import type { AppStateV1 } from "./appState";

export type ExportPayload = {
  stateVersion: number;
  householdId: string;
  exportedAt: string;
  data: AppStateV1;
};

export function buildExportPayload(state: AppStateV1): ExportPayload {
  return {
    stateVersion: state.version,
    householdId: state.householdId,
    exportedAt: new Date().toISOString(),
    data: state,
  };
}
