import { defineManifest } from "@crxjs/vite-plugin";

const LOCAL_MATCHES = ["http://localhost/*", "http://127.0.0.1/*", "http://*.localhost/*"];

export default defineManifest({
  manifest_version: 3,
  name: "Redline",
  version: "1.0.0",
  description:
    "Leave real-time comments on any local interface and let your AI coding assistant act on them.",
  homepage_url: "https://github.com/pallandir/redline",
  permissions: ["activeTab", "storage", "unlimitedStorage", "alarms"],
  optional_permissions: ["debugger"],
  host_permissions: LOCAL_MATCHES,
  options_ui: {
    page: "src/options.html",
    open_in_tab: true,
  },
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
