import assert from "node:assert/strict";
import test from "node:test";
import { assessSoil, initSoilAssessment } from "../public/soil-assessment.js";

const baseSample = {
  ph: "6.4",
  soilKind: "alluvial",
  water: "irrigated",
  organicCarbon: "0.62",
  ec: "0.8",
  nitrogen: "medium",
  phosphorus: "low",
  potassium: "high",
};

test("assessment reports measured indicators without inventing a single soil grade", () => {
  const result = assessSoil(baseSample);
  assert.match(result.summary, /does not produce a single soil-quality grade/);
  assert.match(result.indicators.find((item) => item.name === "Organic carbon").result, /Medium/);
  assert.match(result.indicators.find((item) => item.name === "Phosphorus").result, /Low \(as reported by lab\)/);
  assert.match(result.indicators.find((item) => item.name === "Electrical conductivity").result, /salinity interpretation depends on crop/);
});

test("Indian soil manual organic-carbon boundaries are applied as low, medium, and high", () => {
  for (const [organicCarbon, expected] of [["0.49", "Low"], ["0.5", "Medium"], ["0.75", "Medium"], ["0.76", "High"]]) {
    const result = assessSoil({ ...baseSample, organicCarbon });
    assert.match(result.indicators.find((item) => item.name === "Organic carbon").result, new RegExp(expected));
  }
});

test("rainfed shortlist excludes rice while irrigation can retain it where listed", () => {
  const irrigated = assessSoil({ ...baseSample, soilKind: "red", water: "irrigated" });
  const rainfed = assessSoil({ ...baseSample, soilKind: "red", water: "rainfed" });
  assert.ok(irrigated.crops.some((crop) => crop.name.startsWith("Rice")));
  assert.ok(!rainfed.crops.some((crop) => crop.name.startsWith("Rice")));
});

test("soil group maps to its broad crop shortlist", () => {
  const result = assessSoil({ ...baseSample, soilKind: "black" });
  assert.deepEqual(result.crops.map((crop) => crop.name), ["Cotton", "Soybean", "Sorghum", "Pulses"]);
  assert.ok(result.crops.every((crop) => /Indicative option/.test(crop.reason)));
});

test("required, out-of-range, and unrecognized inputs are rejected", () => {
  assert.throws(() => assessSoil({ ...baseSample, ph: "" }), /Enter the pH/);
  assert.throws(() => assessSoil({ ...baseSample, ph: "15" }), /Soil pH must be between/);
  assert.throws(() => assessSoil({ ...baseSample, soilKind: "unknown" }), /Choose a soil group/);
  assert.throws(() => assessSoil({ ...baseSample, nitrogen: "very-low" }), /valid lab status/);
  assert.throws(() => assessSoil({ ...baseSample, ec: "-1" }), /Electrical conductivity must be between/);
});

class FakeElement {
  value = "";
  hidden = true;
  disabled = false;
  lang = "";
  textContent = "";
  listeners = new Map();
  children = [];

  addEventListener(type, callback) { this.listeners.set(type, callback); }
  replaceChildren(...children) { this.children = children; }
  async emit(type, event = {}) { await this.listeners.get(type)?.(event); }
}

test("soil form renders a local assessment and crop shortlist", async () => {
  const elements = new Map();
  const requests = [];
  let shouldFail = false;
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new FakeElement());
      return elements.get(selector);
    },
    createElement() { return new FakeElement(); },
  };
  document.querySelector("#language").value = "te-IN";
  const fields = {
    ph: "6.4",
    soilKind: "alluvial",
    organicCarbon: "0.8",
    ec: "",
    nitrogen: "medium",
    phosphorus: "medium",
    potassium: "low",
    water: "irrigated",
    drainage: "good",
    compaction: "no",
    earthworms: "seen",
  };
  for (const [name, value] of Object.entries(fields)) document.querySelector(`[name="${name}"]`).value = value;

  initSoilAssessment(document, {
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (shouldFail) throw new Error("CLI unavailable");
      return {
        ok: true,
        async json() {
          return { language: "te-IN", explanation: "తెలుగులో మట్టి వివరణ" };
        },
      };
    },
  });
  let prevented = false;
  await document.querySelector("#soil-form").emit("submit", { preventDefault() { prevented = true; } });

  assert.equal(prevented, true);
  assert.equal(document.querySelector("#soil-result").hidden, false);
  assert.match(document.querySelector("#soil-summary").textContent, /Screening completed/);
  assert.ok(document.querySelector("#soil-indicators").children.some((item) => /Organic carbon: 0.80% · High/.test(item.textContent)));
  assert.ok(document.querySelector("#soil-crops").children.some((item) => /Wheat/.test(item.textContent)));
  assert.equal(document.querySelector("#soil-explain-button").disabled, false);

  await document.querySelector("#soil-explain-button").emit("click");
  assert.equal(requests[0].url, "/api/soil-explain");
  assert.deepEqual(Object.keys(JSON.parse(requests[0].options.body)).sort(), ["language", "readings", "results"]);
  assert.equal(JSON.parse(requests[0].options.body).language, "te-IN");
  assert.deepEqual(JSON.parse(requests[0].options.body).readings, fields);
  assert.equal(document.querySelector("#soil-explanation-text").textContent, "తెలుగులో మట్టి వివరణ");
  assert.equal(document.querySelector("#soil-explanation").lang, "te-IN");
  assert.equal(document.querySelector("#soil-explanation").hidden, false);

  const offlineSummary = document.querySelector("#soil-summary").textContent;
  shouldFail = true;
  await document.querySelector("#soil-explain-button").emit("click");
  assert.equal(document.querySelector("#soil-summary").textContent, offlineSummary);
  assert.match(document.querySelector("#soil-explain-status").textContent, /offline soil screening is still available/i);
});
