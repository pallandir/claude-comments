const DEBUGGER: chrome.permissions.Permissions = { permissions: ["debugger"] };

const grantBtn = document.getElementById("grant") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLElement;

async function refresh(): Promise<void> {
  const granted = await chrome.permissions.contains(DEBUGGER);
  statusEl.dataset.granted = String(granted);
  statusEl.textContent = granted
    ? "Granted. Precise mode is available."
    : "Not granted. Precise mode falls back to a best-effort CSS hint.";
  grantBtn.disabled = granted;
  grantBtn.textContent = granted ? "Access granted" : "Grant Precise-mode access";
}

grantBtn.addEventListener("click", async () => {
  try {
    await chrome.permissions.request(DEBUGGER);
  } catch {
    // user dismissed the prompt
  }
  await refresh();
});

void refresh();
