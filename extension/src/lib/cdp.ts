export interface StyleSourceLocation {
  file: string;
  line: number;
}

interface CssProperty {
  name: string;
  disabled?: boolean;
}
interface CssStyle {
  cssProperties?: CssProperty[];
  range?: { startLine: number };
  styleSheetId?: string;
}
interface CssRule {
  origin: string;
  style: CssStyle;
  styleSheetId?: string;
}
interface MatchedStyles {
  matchedCSSRules?: { rule: CssRule }[];
}

export async function resolveStyleSource(
  tabId: number,
  selector: string,
  property: string,
): Promise<StyleSourceLocation | null> {
  const target: chrome.debugger.Debuggee = { tabId };
  const sheets = new Map<string, string>();

  const onEvent = (src: chrome.debugger.Debuggee, method: string, params?: object) => {
    if (src.tabId !== tabId || method !== "CSS.styleSheetAdded") return;
    const header = (params as { header: { styleSheetId: string; sourceURL?: string } }).header;
    sheets.set(header.styleSheetId, header.sourceURL ?? "");
  };
  chrome.debugger.onEvent.addListener(onEvent);

  try {
    await chrome.debugger.attach(target, "1.3");
    await send(target, "DOM.enable");
    await send(target, "CSS.enable");
    await delay(60);

    const doc = (await send(target, "DOM.getDocument", { depth: -1 })) as {
      root: { nodeId: number };
    };
    const node = (await send(target, "DOM.querySelector", {
      nodeId: doc.root.nodeId,
      selector,
    })) as { nodeId: number };
    if (!node.nodeId) return null;

    const matched = (await send(target, "CSS.getMatchedStylesForNode", {
      nodeId: node.nodeId,
    })) as MatchedStyles;
    return pickSource(matched, property, sheets);
  } catch {
    return null;
  } finally {
    chrome.debugger.onEvent.removeListener(onEvent);
    await chrome.debugger.detach(target).catch(() => {});
  }
}

function pickSource(
  matched: MatchedStyles,
  property: string,
  sheets: Map<string, string>,
): StyleSourceLocation | null {
  let best: CssRule | null = null;
  for (const match of matched.matchedCSSRules ?? []) {
    const rule = match.rule;
    if (rule.origin === "user-agent") continue;
    const declares = (rule.style.cssProperties ?? []).some(
      (p) => p.name === property && !p.disabled,
    );
    if (declares && rule.style.range && rule.styleSheetId) best = rule;
  }
  if (!best?.style.range || !best.styleSheetId) return null;
  const sourceUrl = sheets.get(best.styleSheetId) ?? "";
  return {
    file: sourceUrl ? cleanUrl(sourceUrl) : "inline",
    line: best.style.range.startLine + 1,
  };
}

function cleanUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, "").split("?")[0];
  } catch {
    return url;
  }
}

function send(target: chrome.debugger.Debuggee, method: string, params?: object): Promise<unknown> {
  return chrome.debugger.sendCommand(target, method, params);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
