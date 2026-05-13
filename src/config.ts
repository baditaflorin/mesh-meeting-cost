import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-meeting-cost",
  description:
    "Live meeting cost meter — punch in your rate, see what the meeting is costing in real time",
  accentHex: "#06b6d4",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
