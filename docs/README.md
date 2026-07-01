# Redline documentation

This folder explains how Redline is put together and how a comment travels from a
click in the browser to a change in your source code. It is diagrams and prose
only, no source listings. Read the pages in this order:

1. [How it works](./how-it-works.md) is the plain-language tour: what happens
   when you leave a comment, where it goes, and how the assistant picks it up.
2. [Architecture](./architecture.md) breaks the system into its components and
   shows how they connect and what each one owns.
3. [Flows](./flows.md) has the step-by-step sequence diagrams for pairing a
   session, sending a batch, resolving work, and scoring a page.
4. [Releasing](./releasing.md) covers publishing the MCP server to npm and
   packaging the extension for the store.

If you only read one page, read [How it works](./how-it-works.md).

For the original design rationale and the goals and non-goals of v1, see
[DESIGN.md](../DESIGN.md) at the repo root. For the security model, see
[SECURITY.md](../SECURITY.md).
