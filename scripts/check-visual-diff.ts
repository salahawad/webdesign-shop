import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { demos } from "../lib/demo";

// Use an existing Playwright installation without adding a runtime dependency.
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? "playwright");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const source = await readFile(
    new URL("../lib/visual-diff.ts", import.meta.url),
    "utf8",
  );
  const javascript = ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ES2020,
      },
    })
    .outputText.replace(
      "export function highlightChanges",
      "function highlightChanges",
    );
  await page.addScriptTag({ content: javascript });
  const inspect = (before: string, after: string) =>
    page.evaluate(
      ([left, right]: string[]) => {
        const html = (window as any).highlightChanges(left, right) as string[];
        return html.map((source) => {
          const document = new DOMParser().parseFromString(source, "text/html");
          return [...document.querySelectorAll("[data-studio-change]")].map(
            (element) => ({
              tag: element.tagName,
              kind: element.getAttribute("data-studio-change"),
              text: element.textContent?.trim(),
            }),
          );
        });
      },
      [before, after],
    );

  const versions = demos[0].versions;
  const [before, after] = await inspect(versions[1].html!, versions[2].html!);
  assert.deepEqual(
    before.map((element: any) => [element.tag, element.kind]),
    [["H1", "changed"]],
  );
  assert.deepEqual(
    after.map((element: any) => [element.tag, element.kind]),
    [
      ["H1", "changed"],
      ["P", "added"],
      ["SPAN", "added"],
    ],
  );
  assert.match(after[1].text, /Free shipping/);
  assert.match(after[2].text, /Refillable/);
  const [swapped] = await inspect(versions[2].html!, versions[1].html!);
  assert.deepEqual(
    swapped.map((element: any) => element.kind),
    ["changed", "removed", "removed"],
  );
  assert.deepEqual(await inspect(versions[1].html!, versions[1].html!), [
    [],
    [],
  ]);

  const [oldSiblings, newSiblings] = await inspect(
    "<main><p>One</p><p>Two</p></main>",
    "<main><p>One</p><p>Inserted</p><p>Two</p></main>",
  );
  assert.deepEqual(oldSiblings, []);
  assert.deepEqual(newSiblings, [
    { tag: "P", kind: "added", text: "Inserted" },
  ]);
  const [oldGap, newGap] = await inspect(
    "<h1>Old</h1><footer>Same</footer>",
    "<div>Added</div><h1>New</h1><footer>Same</footer>",
  );
  assert.deepEqual(oldGap, [{ tag: "H1", kind: "changed", text: "Old" }]);
  assert.deepEqual(
    newGap.map((element: any) => element.kind),
    ["added", "changed"],
  );

  const markup = '<button class="cta">Go</button><p>Unchanged</p>';
  const css = await inspect(
    `<style>.cta{background:red}</style>${markup}`,
    `<style>.cta{background:blue}</style>${markup}`,
  );
  assert.deepEqual(
    css,
    Array(2).fill([{ tag: "BUTTON", kind: "changed", text: "Go" }]),
  );
  const grouped = await inspect(
    `<style>@media(min-width:1px){.cta{color:red}}</style>${markup}`,
    `<style>@media(min-width:1px){.cta{color:blue}}</style>${markup}`,
  );
  assert.deepEqual(grouped, css);
  const reordered = await inspect(
    `<style>.cta{color:red}button{color:blue}</style>${markup}`,
    `<style>button{color:blue}.cta{color:red}</style>${markup}`,
  );
  assert.deepEqual(reordered, css);
  const movedText = await inspect("<p>a<b>b</b>c</p>", "<p>ac<b>b</b></p>");
  assert.deepEqual(
    movedText.map((elements: any[]) =>
      elements.map((element) => [element.tag, element.kind]),
    ),
    [[["P", "changed"]], [["P", "changed"]]],
  );
  const root = await inspect(
    '<html dir="ltr"><body>Same</body></html>',
    '<html dir="rtl"><body>Same</body></html>',
  );
  assert.deepEqual(
    root.map((elements: any[]) =>
      elements.map((element) => [element.tag, element.kind]),
    ),
    [[["BODY", "changed"]], [["BODY", "changed"]]],
  );
  const attributes = await inspect(
    '<a href="/old">Link</a>',
    '<a href="/new">Link</a>',
  );
  assert.deepEqual(
    attributes,
    Array(2).fill([{ tag: "A", kind: "changed", text: "Link" }]),
  );
  const [, subtree] = await inspect(
    "<p>Same</p>",
    "<p>Same</p><section><h2>Added</h2><p>More</p></section>",
  );
  assert.deepEqual(
    subtree.map((element: any) => [element.tag, element.kind]),
    [["SECTION", "added"]],
  );
  const metadata = await inspect(
    '<title>Old</title><script>console.log("old")</script><p>Same</p>',
    '<title>New</title><script>console.log("new")</script><p>Same</p>',
  );
  assert.deepEqual(metadata, [[], []]);
  const preserved = await page.evaluate(() =>
    (window as any).highlightChanges(
      "<!doctype html><p>Old</p><script>window.demo=1</script>",
      "<!doctype html><p>New</p><script>window.demo=1</script>",
    ),
  );
  assert.match(preserved[0], /^<!DOCTYPE html>/i);
  assert.match(preserved[0], /<script>window.demo=1<\/script>/);
  console.log("Visual diff browser checks passed.");
} finally {
  await browser.close();
}
