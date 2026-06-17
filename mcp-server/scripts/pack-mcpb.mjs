import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const stage = join(root, ".mcpb-stage");
const out = join(root, "..", "redline.mcpb");
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit" });

run("npm run build", root);

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync(join(root, "dist"), join(stage, "dist"), { recursive: true });
cpSync(join(root, "manifest.json"), join(stage, "manifest.json"));
cpSync(join(root, "..", "LICENSE.md"), join(stage, "LICENSE.md"));

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
writeFileSync(
  join(stage, "package.json"),
  `${JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      type: pkg.type,
      bin: pkg.bin,
      dependencies: pkg.dependencies,
    },
    null,
    2,
  )}\n`,
);

run("npm install --omit=dev --no-audit --no-fund --ignore-scripts --no-package-lock", stage);
run(`mcpb pack "${stage}" "${out}"`, root);
rmSync(stage, { recursive: true, force: true });
