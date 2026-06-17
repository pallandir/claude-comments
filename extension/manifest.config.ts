import { defineManifest } from "@crxjs/vite-plugin";

const LOCAL_MATCHES = ["http://localhost/*", "http://127.0.0.1/*"];

export default defineManifest({
  manifest_version: 3,
  name: "Claude Comments",
  version: "0.1.0",
  description: "Right-click comments on a local frontend, picked up by Claude Code.",
  permissions: ["contextMenus", "activeTab", "scripting", "storage", "alarms"],
  host_permissions: LOCAL_MATCHES,
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: LOCAL_MATCHES,
      js: ["src/content/content.ts"],
      run_at: "document_idle",
    },
  ],
  action: {
    default_popup: "src/popup/index.html",
    default_title: "Claude Comments",
  },
});
