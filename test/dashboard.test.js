import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { initDashboard } from "../public/dashboard.js";

class Element {
  listeners = new Map();
  attributes = new Map();
  classes = new Set();
  classList = { add: (name) => this.classes.add(name), remove: (name) => this.classes.delete(name) };
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  dispatchEvent(event) { this.listeners.get(event.type)?.(event); }
  click() { this.clicked = true; }
  getAttribute(name) { return this.attributes.get(name); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
}

function setup() {
  const elements = new Map(["#crop-photo", "#photo-drop", "#scan-trigger", "#model-status"].map((id) => [id, new Element()]));
  const links = ["#main-content", "#new-scan", "#soil-assessment"].map((href) => {
    const link = new Element();
    link.setAttribute("href", href);
    return link;
  });
  const window = new Element();
  window.location = { hash: "" };
  window.Event = Event;
  initDashboard({ document: { querySelector: (id) => elements.get(id), querySelectorAll: () => links }, window });
  return { get: (id) => elements.get(id), window, links };
}

test("scan button opens the existing photo picker", () => {
  const app = setup();
  app.get("#scan-trigger").dispatchEvent(new Event("click"));
  assert.equal(app.get("#crop-photo").clicked, true);
});

test("dropping a single image uses the existing photo-change flow", () => {
  const app = setup();
  const drop = app.get("#photo-drop");
  const input = app.get("#crop-photo");
  let changes = 0;
  input.addEventListener("change", () => { changes += 1; });
  const drag = new Event("dragover", { cancelable: true });
  drop.dispatchEvent(drag);
  assert.equal(drag.defaultPrevented, true);
  assert.equal(drop.classes.has("is-dragging"), true);
  const files = [{ name: "leaf.png", type: "image/png" }];
  drop.dispatchEvent({ type: "drop", preventDefault() {}, dataTransfer: { files } });
  assert.equal(input.files, files);
  assert.equal(changes, 1);
  assert.equal(drop.classes.has("is-dragging"), false);
});

test("invalid or multiple dropped files do not replace the selected leaf", () => {
  const app = setup();
  const original = [{ name: "leaf.png", type: "image/png" }];
  app.get("#crop-photo").files = original;
  for (const files of [[], [{ type: "text/plain" }], [...original, ...original]]) {
    app.get("#photo-drop").dispatchEvent({ type: "drop", preventDefault() {}, dataTransfer: { files } });
    assert.equal(app.get("#crop-photo").files, original);
    assert.match(app.get("#model-status").textContent, /one image file/);
  }
});

test("navigation highlights the current anchor and handles back navigation", () => {
  const app = setup();
  assert.equal(app.links[0].getAttribute("aria-current"), "location");
  app.window.location.hash = "#soil-assessment";
  app.window.dispatchEvent(new Event("hashchange"));
  assert.equal(app.links[0].getAttribute("aria-current"), undefined);
  assert.equal(app.links[2].getAttribute("aria-current"), "location");
  app.window.location.hash = "";
  app.window.dispatchEvent(new Event("hashchange"));
  assert.equal(app.links[0].getAttribute("aria-current"), "location");
});

test("dashboard markup has unique IDs, working anchors and offline-cached enhancements", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(target), target);
  assert.match(worker, /"\/dashboard\.js"/);
  assert.match(html, /model confidence, not the area of leaf affected/);
  assert.match(html, /Your next leaf check\s+<br\s*\/>starts here\./);
});