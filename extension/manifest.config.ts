import { defineManifest } from "@crxjs/vite-plugin";

const LOCAL_MATCHES = ["http://localhost/*", "http://127.0.0.1/*"];

export default defineManifest({
  manifest_version: 3,
  name: "Redline",
  version: "0.1.0",
  description:
    "A Figma-style dev toolbar to comment on and tweak a local frontend for Claude Code.",
  permissions: ["activeTab", "scripting", "storage", "unlimitedStorage", "alarms", "debugger"],
  host_permissions: ["<all_urls>"],
  icons: {
    "16": "icon-16.png",
    "32": "icon-32.png",
    "48": "icon-48.png",
    "128": "icon-128.png",
  },
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
    default_title: "Redline, click to toggle on this page",
    default_icon: {
      "16": "icon-16.png",
      "32": "icon-32.png",
      "48": "icon-48.png",
      "128": "icon-128.png",
    },
  },
});
