# Flows

These sequence diagrams show the message order for the four things Northstar does:
pairing a session and watching, sending a batch, resolving or deferring work, and
scoring a page. The participants are the toolbar (in the content script), the
extension transport layer, the server's HTTP listener, the broker, the comment
store, and the AI assistant.

## 1. Pair a session and enter the watch loop

Pairing starts in the browser, which shows a session id. You paste the watch
command into the assistant. The id is the credential: the assistant claims it over
stdio, and the extension proves it over loopback.

```mermaid
sequenceDiagram
    participant U as You
    participant T as Toolbar
    participant A as Assistant
    participant M as MCP server
    participant B as Broker

    T->>T: generate session id
    U->>A: paste /mcp__northstar__watch <id>
    A->>M: bind_session(id)
    M->>B: claim ownership, store token
    M-->>A: bound, storeRoot, watchProtocol
    A->>M: list_rating_requests
    loop watch loop
        A->>M: wait_for_update
        M->>B: register waiter, heartbeat binding
        B-->>M: store changed (or timeout)
        M-->>A: version, openComments, pendingRatings, stop
        Note over A: handle comments and ratings,<br/>then wait again
    end
```

The loop only ends when `wait_for_update` reports `stop: true` (the extension
disconnected) or you ask the assistant to stop. Either way it calls
`unbind_session` so the toolbar flips out of watching straight away.

## 2. Capture a comment and send the batch

Saving a comment is local and instant. Sending is the moment data crosses to the
server and wakes the loop.

```mermaid
sequenceDiagram
    participant U as You
    participant T as Toolbar
    participant X as Transport
    participant H as HTTP listener
    participant S as Store
    participant B as Broker
    participant M as MCP server
    participant A as Assistant

    U->>T: pick element, write comment, Save
    T->>X: enqueue draft
    X->>X: write to chrome.storage
    Note over X: nothing sent yet
    U->>T: click Send to AI
    X->>H: POST /comments (token + payload)
    H->>S: validate, save screenshot, upsert
    H->>B: bump version
    B-->>M: wakes wait_for_update
    M-->>A: version, openComments
    A->>M: list_comments("open")
    A->>A: sub-agent implements the batch
```

Save enqueues, Send flushes. A comment that is only saved never reaches the
assistant, which is the single most common reason a batch looks like it was
missed.

## 3. Resolve or defer

After the sub-agent works through a batch it reports one line per comment. The
assistant writes those outcomes back through the MCP tools.

```mermaid
sequenceDiagram
    participant A as Assistant
    participant M as MCP server
    participant S as Store
    participant B as Broker
    participant T as Toolbar

    alt implemented
        A->>M: resolve_comment(id, "resolved")
        M->>S: set status
    else too heavy or too vague
        A->>M: defer_comment(id, reason, category)
        M->>S: add to deferred, set wontfix
        M->>B: push toolbar notice
        B-->>T: show deferred notice
    end
    M->>B: bump version
```

Deferrals split into two kinds: `needs-plan` for changes that are too heavy to do
inline, and `feedback` for comments too vague to act on. Both leave a notice in
the toolbar so you know they were parked, not dropped.

## 4. Score a page

A rating request follows the same wake-and-handle shape as comments, but on its
own channel.

```mermaid
sequenceDiagram
    participant U as You
    participant X as Transport
    participant H as HTTP listener
    participant S as Store
    participant B as Broker
    participant A as Assistant
    participant G as Scoring sub-agent

    U->>X: request a page rating
    X->>H: POST /ratings (screenshot)
    H->>S: record pending request
    H->>B: bump version
    B-->>A: wait_for_update reports pendingRatings
    A->>G: spawn scoring sub-agent
    G->>S: read screenshot
    G->>A: submit_rating(id, score, ui, ux, coherence, notes, sections)
    A->>S: store score
    S-->>X: score available on next status poll
```

The score is judged against the page's own purpose rather than an absolute bar,
so a clean utility UI can score well without dramatic motion or type.
