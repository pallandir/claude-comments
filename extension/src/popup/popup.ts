import type { Message, Response } from "../messages.js";

const statusEl = document.getElementById("status") as HTMLParagraphElement;
const flushBtn = document.getElementById("flush") as HTMLButtonElement;

async function send(message: Message): Promise<Response> {
  return chrome.runtime.sendMessage(message);
}

function paint(res: Response): void {
  if (!res.ok || !res.status) {
    statusEl.textContent = res.ok ? "No status." : res.error;
    return;
  }
  const { queued, serverReachable, port } = res.status;
  statusEl.textContent = serverReachable
    ? `Connected on :${port}. ${queued} queued.`
    : `Claude Code not running. ${queued} queued, will sync when it starts.`;
}

flushBtn.addEventListener("click", async () => {
  flushBtn.disabled = true;
  paint(await send({ type: "flush" }));
  flushBtn.disabled = false;
});

void send({ type: "queue-status" }).then(paint);
