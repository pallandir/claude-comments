import { defineManifest } from "@crxjs/vite-plugin";

// The only hosts the extension may talk to over the network: the loopback
// listener owned by the local MCP server. The service worker needs these to
// fetch the ingest endpoint; nothing here grants access to any web page.
const LOOPBACK_HOSTS = ["http://localhost/*", "http://127.0.0.1/*", "http://*.localhost/*"];

export default defineManifest({
  manifest_version: 3,
  name: "Redline",
  version: "1.0.0",
  description:
    "Leave real-time comments on any interface and route them to your local AI coding assistant.",
  homepage_url: "https://github.com/pallandir/redline",
  // Page access comes solely from activeTab, granted per tab when the user clicks
  // the toolbar action and gone on navigation. No standing access to any site.
  // scripting lets the worker inject the overlay into that one tab on demand.
  permissions: ["activeTab", "scripting", "storage", "unlimitedStorage"],
  host_permissions: LOOPBACK_HOSTS,
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
  action: {
    default_title: "Redline",
    default_popup: "src/popup/popup.html",
    default_icon: {
      "16": "icon-16.png",
      "32": "icon-32.png",
      "48": "icon-48.png",
      "128": "icon-128.png",
    },
  },
});
