# Third-Party Licenses

Northstar ships two published artifacts: the `@northstar/mcp-server` npm package and
the browser extension bundle. The runtime dependencies compiled into those
artifacts are listed below, followed by the attribution for the design-scoring
rubric.

## Bundled runtime dependencies

| Package | Version | License | Source |
| --- | --- | --- | --- |
| `@modelcontextprotocol/sdk` | 1.29.0 | MIT | https://github.com/modelcontextprotocol/typescript-sdk |
| `zod` | 3.25.76 | MIT | https://github.com/colinhacks/zod |
| `dompurify` | 3.4.11 | MPL-2.0 OR Apache-2.0 | https://github.com/cure53/DOMPurify |
| `marked` | 18.0.5 | MIT | https://github.com/markedjs/marked |
| `@material-symbols/svg-400` | 0.45.4 | Apache-2.0 | https://github.com/marella/material-symbols |

The MIT, Apache-2.0, and MPL-2.0 license texts apply as published by each project
at the source above. `@material-symbols/svg-400` repackages Google's Material
Symbols icons, which are themselves licensed under Apache-2.0.

## wondelai-top-design

The Awwwards-style scoring rubric in `plugin/skills/northstar-design-score/SKILL.md` is adapted
from the `wondelai-top-design` skill.

- **Author:** Wondel.ai
- **npm:** `@intentsolutionsio/wondelai-top-design`
- **Source:** https://github.com/jeremylongshore/claude-code-plugins-plus-skills
- **Homepage:** https://tonsofskills.com/plugins/wondelai-top-design

---

MIT License

Copyright (c) Wondel.ai

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
