# Releasing

Northstar ships two artifacts on their own cadence: the `@northstar/mcp-server` npm
package and the browser extension zip for the Chrome Web Store. This page is the
checklist for cutting a release of each.

## Versions

The version lives in two hand-edited places and they must match before a release:

- `mcp-server/package.json` for the npm package.
- `extension/manifest.config.ts` (and `extension/package.json`) for the
  extension.

There is no automatic sync, so bump both when you cut a release. The root
`package.json` version and the plugin manifest version should track the same
number for a coordinated release.

## Publishing the MCP server to npm

Publishing happens in CI, not from a laptop. The package sets
`publishConfig.provenance: true`, and provenance can only be generated from a
supported CI with OIDC, so a manual `npm publish` from your machine will fail. The
release path is a git tag.

### One-time setup

1. Make sure the `@northstar` scope exists on npm and the publishing account owns
   it. `publishConfig.access` is already `public`, which is required for a scoped
   public package.
2. Add an automation `NPM_TOKEN` as a repository secret in GitHub. The workflow
   at `.github/workflows/publish-npm.yml` reads it as `NODE_AUTH_TOKEN`.

### Cutting a release

1. Bump the version in `mcp-server/package.json` (and the other manifests, see
   above).
2. Commit the bump.
3. Tag the release and push the tag. The workflow triggers on any `v*` tag:

   ```sh
   git tag v1.0.0
   git push origin v1.0.0
   ```

The workflow checks out the repo, builds the server, copies the root `LICENSE.md`
into the package, and runs `npm publish --workspace @northstar/mcp-server` with
provenance. You can also run it manually from the Actions tab (`workflow_dispatch`).

### Verify before tagging

Inspect the exact tarball contents without publishing:

```sh
npm pack --dry-run --workspace @northstar/mcp-server
```

The file list should be `dist/`, `README.md`, `LICENSE.md`, and `package.json`,
and nothing from `src/` or `tests/`. The `prepack`
step copies `LICENSE.md` into the package from the repo root, so it is present in
both CI and a local pack even though the file is gitignored.

## Packaging the extension for the store

The extension is submitted as a zip with the manifest at the zip root, which
works for both the Chrome Web Store and Firefox AMO.

1. Build and package in one step:

   ```sh
   npm run package --workspace @northstar/extension
   ```

   This produces `extension/northstar-extension.zip`.

2. Verify the zip is a coherent build before you upload it:

   ```sh
   unzip -l extension/northstar-extension.zip
   ```

   Confirm it contains `manifest.json` at the root, all four icons, the service
   worker loader, the popup html and its js and css, the content-script chunk,
   and the transport chunk, and that the asset hashes referenced in the manifest
   match files actually in the zip. Always re-run the package step after any code
   change so the zip and the manifest come from the same build.

3. Submit using the listing copy in [extension/STORE.md](../extension/STORE.md):
   the description, the permission justifications, the data-use disclosures, and
   the privacy-policy URL. Make sure the repo is public so the privacy-policy URL
   resolves.

## Release checklist

- [ ] Versions bumped and matching across the manifests.
- [ ] CHANGELOG updated for the release.
- [ ] `npm run lint`, typecheck, and tests pass.
- [ ] `npm pack --dry-run` tarball looks right.
- [ ] Extension zip rebuilt and verified with `unzip -l`.
- [ ] Tag pushed (npm), zip uploaded (store).
