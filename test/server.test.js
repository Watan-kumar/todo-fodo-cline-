import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, test } from "node:test";
import { createAppServer, extractClineResponse } from "../server.js";
import { hasLanguage, messages } from "../public/languages.js";
import { INDIAN_STATES_AND_UTS } from "../pesticide-rag.js";
import { assessSoil } from "../public/soil-assessment.js";

let server;
let baseUrl;
const soilExplainCalls = [];
const sampleReadings = {
  ph: "6.4",
  soilKind: "alluvial",
  organicCarbon: "0.62",
  ec: "0.8",
  nitrogen: "medium",
  phosphorus: "low",
  potassium: "high",
  water: "irrigated",
  drainage: "good",
  compaction: "no",
  earthworms: "seen",
};
before(async () => {
  server = createAppServer({
    explainSoil: async (request) => {
      soilExplainCalls.push(request);
      if (request.readings.soilKind === "sandy") throw new Error("mock Cline is unavailable");
      return "स्थानीयकृत मिट्टी की व्याख्या";
    },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

for (const language of Object.keys(messages)) {
  test(`${language}: HTTP intake returns the localized honest placeholder and explicit language`, async () => {
    const response = await fetch(`${baseUrl}/api/intake`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language, symptoms: "A crop query that must not be diagnosed" }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      received: true,
      diseaseModelConnected: false,
      language,
      message: messages[language].ready,
    });
  });
}

test("invalid and unsupported languages never fall back to another language", async () => {
  for (const language of ["en-US", "hi", "", "HI-IN", "toString", "__proto__", null, 42]) {
    assert.equal(hasLanguage(language), false);
    const response = await fetch(`${baseUrl}/api/intake`, {
      method: "POST",
      body: JSON.stringify({ language, symptoms: "query" }),
    });
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.ok(payload.error);
    assert.equal(payload.received, undefined);
    assert.equal(payload.message, undefined);
  }
});

test("malformed, missing and empty intake data are rejected", async () => {
  for (const body of ["{", "null", "[]", "{}", '{"language":"hi-IN"}', '{"language":"hi-IN","symptoms":42}', '{"language":"hi-IN","symptoms":"  "}']) {
    const response = await fetch(`${baseUrl}/api/intake`, { method: "POST", body });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).error);
  }
});

test("health reports that image inference is local and no report LLM is configured by default", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.deepEqual(await response.json(), {
    ok: true,
    diseaseModelConnected: false,
    reportModelConfigured: false,
    localTtsLanguages: process.platform === "darwin" ? ["hi-IN", "te-IN", "ta-IN", "kn-IN"] : [],
  });
});

test("diagnosis report asks for a better photo below the preliminary confidence threshold", async () => {
  const response = await fetch(`${baseUrl}/api/diagnosis-report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      language: "hi-IN",
      label: "Tomato___Late_blight",
      confidence: 0.69,
      state: "Maharashtra",
      notes: "",
    }),
  });
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /clearer photo/i);
});

test("diagnosis report fails closed on unsupported state or class", async () => {
  for (const input of [
    { language: "hi-IN", label: "Tomato___Late_blight", confidence: 0.8, state: "Neverland", notes: "" },
    { language: "hi-IN", label: "invented disease", confidence: 0.8, state: "Maharashtra", notes: "" },
    { language: "hi-IN", label: "Tomato___Late_blight", confidence: 0.8, state: INDIAN_STATES_AND_UTS[0], notes: "x".repeat(1501) },
  ]) {
    const response = await fetch(`${baseUrl}/api/diagnosis-report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 400);
  }
});

test("valid diagnosis report returns no pesticide recommendations while the verified store is empty", async () => {
  const response = await fetch(`${baseUrl}/api/diagnosis-report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      language: "hi-IN",
      label: "Tomato___Late_blight",
      confidence: 0.8,
      state: "Maharashtra",
      notes: "Brown spots on leaves",
    }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.pesticideRows, []);
  assert.equal(payload.generatedByLLM, false);
});

test("soil explanation sends validated readings, recomputed results, and the selected language to Cline", async () => {
  const results = assessSoil(sampleReadings);
  const response = await fetch(`${baseUrl}/api/soil-explain`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ language: "hi-IN", readings: sampleReadings, results }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    language: "hi-IN",
    explanation: "स्थानीयकृत मिट्टी की व्याख्या",
  });
  assert.deepEqual(soilExplainCalls.at(-1), {
    language: "hi-IN",
    readings: sampleReadings,
    assessment: results,
  });
});

test("soil explanation rejects unsupported fields, languages, invalid readings, and tampered calculations", async () => {
  const results = assessSoil(sampleReadings);
  const invalidRequests = [
    { language: "en-US", readings: sampleReadings, results },
    { language: "hi-IN", readings: { ...sampleReadings, symptoms: "free text" }, results },
    { language: "hi-IN", readings: { ...sampleReadings, ph: "6.4", soilKind: "sandy" }, results },
    { language: "hi-IN", readings: sampleReadings, results, photo: "private image" },
  ];

  for (const input of invalidRequests) {
    const response = await fetch(`${baseUrl}/api/soil-explain`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).error);
  }
});

test("Cline failures are reported without invalidating the offline assessment", async () => {
  const sandyReadings = { ...sampleReadings, soilKind: "sandy" };
  const response = await fetch(`${baseUrl}/api/soil-explain`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      language: "hi-IN",
      readings: sandyReadings,
      results: assessSoil(sandyReadings),
    }),
  });

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /offline assessment is still available/i);
});

test("Cline NDJSON parser returns only the final run result", () => {
  assert.equal(
    extractClineResponse([
      JSON.stringify({ type: "agent_event", event: { type: "content_end", text: "partial" } }),
      JSON.stringify({ type: "run_result", finishReason: "completed", text: "Final explanation" }),
    ].join("\n")),
    "Final explanation",
  );
  assert.throws(() => extractClineResponse(JSON.stringify({
    type: "run_result",
    finishReason: "aborted",
    text: "Partial answer",
  })), /usable explanation/i);
});

test("local TTS never substitutes a different language voice", async () => {
  const response = await fetch(`${baseUrl}/api/tts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ language: "ml-IN", text: "മലയാളം ശബ്ദ പരിശോധന" }),
  });
  assert.equal(response.status, 501);
  assert.match((await response.json()).error, /unavailable/i);
});

test("local TTS rejects empty, unsupported, or overlong requests", async () => {
  for (const input of [
    { language: "en-US", text: "Hello" },
    { language: "hi-IN", text: "  " },
    { language: "hi-IN", text: "x".repeat(2001) },
  ]) {
    const response = await fetch(`${baseUrl}/api/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).error);
  }
});

test("browser modules and editable-transcript markup are served", async () => {
  for (const path of [
    "/",
    "/app.js",
    "/dashboard.js",
    "/languages.js",
    "/soil-assessment.js",
    "/onnx-model.js",
    "/states.js",
    "/styles.css",
    "/sw.js",
    "/manifest.webmanifest",
    "/icons/khetsuno.svg",
    "/icons/khetsuno-192.png",
    "/icons/khetsuno-512.png",
    "/vendor/ort.wasm.min.js",
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).length > 0);
  }
});
