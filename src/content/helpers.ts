/**
 * DOM extraction helpers shared across content scripts.
 * Designed for resilience against layout changes by preferring
 * label/text-based traversal over strict CSS selectors.
 */

/** Find the first element whose visible text matches a label, then return its next sibling's text. */
export function findFieldByLabel(
  root: ParentNode,
  labelText: string
): string | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent?.trim().toLowerCase() === labelText.toLowerCase()) {
      // Check parent's next sibling, or parent's next element
      const parent = node.parentElement;
      if (!parent) continue;

      // Case 1: <dt>Label</dt><dd>Value</dd>
      const nextSib = parent.nextElementSibling;
      if (nextSib) {
        const text = nextSib.textContent?.trim();
        if (text) return text;
      }

      // Case 2: label is inside a container, value is the next child
      const container = parent.parentElement;
      if (container) {
        const children = Array.from(container.children);
        const idx = children.indexOf(parent);
        if (idx >= 0 && idx + 1 < children.length) {
          const text = children[idx + 1].textContent?.trim();
          if (text) return text;
        }
      }
    }
  }
  return null;
}

/** Read the value of an input/textarea associated with a label. */
export function readInputByLabel(
  root: ParentNode,
  labelText: string
): string | null {
  const labels = root.querySelectorAll("label");
  for (const label of labels) {
    if (label.textContent?.trim().toLowerCase() === labelText.toLowerCase()) {
      const forId = label.getAttribute("for");
      if (forId) {
        const input = root.querySelector<
          HTMLInputElement | HTMLTextAreaElement
        >(`#${CSS.escape(forId)}`);
        if (input) return input.value?.trim() || null;
      }
      // Nested input inside label
      const nested = label.querySelector<
        HTMLInputElement | HTMLTextAreaElement
      >("input, textarea, select");
      if (nested) return nested.value?.trim() || null;
    }
  }
  return null;
}

/** Read a definition-list value by its <dt> label text. */
export function readDefinitionListValue(
  root: ParentNode,
  dtText: string
): string | null {
  const dts = root.querySelectorAll("dt");
  for (const dt of dts) {
    if (dt.textContent?.trim().toLowerCase() === dtText.toLowerCase()) {
      const dd = dt.nextElementSibling;
      if (dd?.tagName === "DD") {
        return dd.textContent?.trim() || null;
      }
    }
  }
  return null;
}

/**
 * Wait for an element matching the selector to appear in the DOM.
 * Resolves when found; rejects after timeout.
 */
export function waitForElement(
  selector: string,
  timeout = 10_000
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for "${selector}"`));
    }, timeout);
  });
}
