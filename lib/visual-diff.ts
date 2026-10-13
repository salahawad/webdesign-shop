type Change = "changed" | "added" | "removed";

const marker = "data-studio-change";
const ignored = new Set([
  "SCRIPT",
  "STYLE",
  "TEMPLATE",
  "META",
  "LINK",
  "TITLE",
  "NOSCRIPT",
]);

const children = (element: Element) =>
  [...element.children].filter((child) => !ignored.has(child.tagName));

const text = (element: Element) =>
  JSON.stringify(
    [...element.childNodes]
      .filter((node) =>
        node.nodeType === Node.ELEMENT_NODE
          ? !ignored.has((node as Element).tagName)
          : node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      )
      .flatMap((node, index) =>
        node.nodeType === Node.TEXT_NODE
          ? [[index, node.textContent?.replace(/\s+/g, " ").trim()]]
          : [],
      ),
  );

const attributes = (element: Element) =>
  JSON.stringify(
    [...element.attributes]
      .filter((attribute) => attribute.name !== marker)
      .map((attribute) => [attribute.name, attribute.value])
      .sort(([a], [b]) => a.localeCompare(b)),
  );

function mark(element: Element, kind: Change) {
  if (!element.hasAttribute(marker)) element.setAttribute(marker, kind);
}

function compare(before: Element, after: Element) {
  if (
    text(before) !== text(after) ||
    attributes(before) !== attributes(after)
  ) {
    mark(before, "changed");
    mark(after, "changed");
  }

  const left = children(before);
  const right = children(after);
  const positions = new Map<string, number[]>();
  right.forEach((element, index) => {
    const key = element.id
      ? `${element.tagName}#${element.id}`
      : element.outerHTML;
    const indexes = positions.get(key) ?? [];
    indexes.push(index);
    positions.set(key, indexes);
  });

  let i = 0;
  let j = 0;
  const gap = (endLeft: number, endRight: number) => {
    while (i < endLeft || j < endRight) {
      if (i < endLeft && j < endRight && left[i].tagName === right[j].tagName) {
        compare(left[i++], right[j++]);
      } else if (
        j < endRight &&
        i < endLeft &&
        right
          .slice(j + 1, endRight)
          .some((element) => element.tagName === left[i].tagName)
      ) {
        mark(right[j++], "added");
      } else if (i < endLeft) {
        mark(left[i++], "removed");
      } else {
        mark(right[j++], "added");
      }
    }
  };

  // Unchanged siblings anchor the gaps so an insertion does not shift later matches.
  for (let index = 0; index < left.length; index++) {
    const element = left[index];
    const key = element.id
      ? `${element.tagName}#${element.id}`
      : element.outerHTML;
    const anchor = positions.get(key)?.find((position) => position >= j);
    if (anchor === undefined) continue;
    gap(index, anchor);
    compare(left[i++], right[j++]);
  }
  gap(left.length, right.length);
}

function styleRules(document: Document) {
  const rules = new Map<string, { selector: string; css: string }>();
  const visit = (list: CSSRuleList, context = "") => {
    for (const rule of list) {
      if (rule instanceof CSSStyleRule) {
        const key = `${context}\n${rule.selectorText}`;
        rules.set(key, {
          selector: rule.selectorText,
          css: (rules.get(key)?.css ?? "") + rule.style.cssText,
        });
      } else if ("cssRules" in rule) {
        visit(
          (rule as CSSGroupingRule).cssRules,
          `${context}\n${rule.cssText.split("{")[0]}`,
        );
      }
    }
  };
  for (const style of document.querySelectorAll("style")) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(style.textContent ?? "");
    visit(sheet.cssRules);
  }
  return rules;
}

export function highlightChanges(beforeHtml: string, afterHtml: string) {
  if (beforeHtml === afterHtml) return [beforeHtml, afterHtml];
  const parser = new DOMParser();
  const before = parser.parseFromString(beforeHtml, "text/html");
  const after = parser.parseFromString(afterHtml, "text/html");
  for (const document of [before, after]) {
    for (const element of document.querySelectorAll(`[${marker}]`)) {
      element.removeAttribute(marker);
    }
  }
  compare(before.body, after.body);
  if (
    attributes(before.documentElement) !== attributes(after.documentElement)
  ) {
    mark(before.body, "changed");
    mark(after.body, "changed");
  }

  const leftRules = styleRules(before);
  const rightRules = styleRules(after);
  const leftOrder = [...leftRules.keys()].filter((key) => rightRules.has(key));
  const rightOrder = [...rightRules.keys()].filter((key) => leftRules.has(key));
  const reordered = new Set(
    leftOrder.flatMap((key, index) =>
      key === rightOrder[index] ? [] : [key, rightOrder[index]],
    ),
  );
  for (const key of new Set([...leftRules.keys(), ...rightRules.keys()])) {
    const left = leftRules.get(key);
    const right = rightRules.get(key);
    if (left?.css === right?.css && !reordered.has(key)) continue;
    const selector = (left ?? right)!.selector.replace(
      /::[\w-]+(?:\([^)]*\))?/g,
      "",
    );
    for (const document of [before, after]) {
      try {
        for (const element of document.querySelectorAll(selector)) {
          if (
            document.body.contains(element) &&
            !ignored.has(element.tagName)
          ) {
            mark(element, "changed");
          }
        }
      } catch {
        // Some valid stylesheet selectors cannot be queried as DOM elements.
      }
    }
  }

  return [before, after].map((document) => {
    const style = document.createElement("style");
    style.textContent = `
      [${marker}] { outline-offset: 3px !important; }
      [${marker}="changed"] { outline: 3px solid #d97706 !important; }
      [${marker}="added"] { outline: 3px solid #16a34a !important; }
      [${marker}="removed"] { outline: 3px dashed #dc2626 !important; }
    `;
    document.head.append(style);
    const doctype = document.doctype;
    return (
      (doctype ? new XMLSerializer().serializeToString(doctype) : "") +
      document.documentElement.outerHTML
    );
  });
}
