export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [2, "always", ["extension", "mcp-server", "root", "deps", "ci", "docs"]],
  },
};
