import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-meeting-cost",
  breadcrumbs: false,
  displayName: "Meeting Cost",
  visualProfile: "utility",
  shellLayout: "inset",
  description: "A live, shared meeting ledger that calculates the room's cost in real time.",
  accentHex: "#9dbdff",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
