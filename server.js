import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { hasLanguage, messages } from "./public/languages.js";
import {
  buildDiagnosisPrompt,
  INDIAN_STATES_AND_UTS,
  parseDiagnosisReport,
  retrievePesticideRows,
} from "./pesticide-rag.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(root, "public");
const runtimeDir = resolve(root, "node_modules", "onnxruntime-web", "dist");
const pesticideKnowledgePath = resolve(root, "data", "pesticide-knowledge.json");
const diseaseLabelsPath = resolve(publicDir, "models", "plantvillage-38-labels.json");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const runFile = promisify(execFile);
const localVoices = {
  "hi-IN": "Lekha",
  "te-IN": "Geeta",
  "ta-IN": "Vani",
  "kn-IN": "Soumya",
};
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".onnx": "application/octet-stream",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": mimeTypes[".json"] });
  response.end(JSON.stringify(payload));
}

async function renderLocalSpeech(language, text) {
  const voice = localVoices[language];
  if (process.platform !== "darwin" || !voice) return null;

  const directory = await mkdtemp(join(tmpdir(), "khetsuno-tts-"));
  const sourcePath = join(directory, "speech.aiff");
  const outputPath = join(directory, "speech.wav");
  try {
    await runFile("/usr/bin/say", ["-v", voice, "-o", sourcePath, text], { timeout: 15000 });
    await runFile("/usr/bin/afconvert", ["-f", "WAVE", "-d", "LEI16", sourcePath, outputPath], { timeout: 15000 });
    return await readFile(outputPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function handleDiagnosisReport(request, response) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 10_000) {
      return sendJson(response, 413, { error: "Diagnosis report request is too large." });
    }
  }

  try {
    const input = JSON.parse(body || "{}");
    if (!input || !hasLanguage(input.language)
      || typeof input.label !== "string"
      || !Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1
      || typeof input.state !== "string"
      || !INDIAN_STATES_AND_UTS.includes(input.state)
      || typeof input.notes !== "string" || input.notes.length > 1500) {
      return sendJson(response, 400, { error: "A supported language, class, score, state, and short note are required." });
    }
    if (input.confidence < 0.7) {
      return sendJson(response, 422, { error: "A clearer photo is needed before generating a report." });
    }

    const [labelsText, knowledgeText] = await Promise.all([
      readFile(diseaseLabelsPath, "utf8").catch(() => null),
      readFile(pesticideKnowledgePath, "utf8").catch(() => null),
    ]);
    if (!labelsText || !knowledgeText) {
      return sendJson(response, 503, { error: "The local model labels or verified treatment knowledge file is missing." });
    }

    let labels;
    let knowledgeRows;
    try {
      labels = JSON.parse(labelsText);
      knowledgeRows = JSON.parse(knowledgeText);
    } catch {
      return sendJson(response, 503, { error: "The local model labels or verified treatment knowledge file is invalid." });
    }
    if (!Array.isArray(labels) || !labels.includes(input.label) || !Array.isArray(knowledgeRows)) {
      return sendJson(response, 400, { error: "The disease label or local knowledge file is invalid." });
    }

    const pesticideRows = retrievePesticideRows(knowledgeRows, {
      className: input.label,
      state: input.state,
    });
    const model = process.env.OLLAMA_MODEL?.trim();
    if (!model) {
      return sendJson(response, 200, {
        generatedByLLM: false,
        pesticideRows,
        message: "Install and configure a local Ollama instruct model to generate the explanatory report.",
      });
    }

    try {
      const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/chat";
      let target;
      try {
        target = new URL(ollamaUrl);
      } catch {
        return sendJson(response, 500, { error: "The local report model URL is invalid." });
      }
      if (target.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
        return sendJson(response, 500, { error: "The report model must run locally on this machine." });
      }
      const ollamaResponse = await fetch(ollamaUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        redirect: "error",
        body: JSON.stringify({
          model,
          stream: false,
          format: "json",
          messages: [
            { role: "system", content: "You write conservative crop health screening reports. Follow the requested JSON fields exactly." },
            {
              role: "user",
              content: buildDiagnosisPrompt({
                language: input.language,
                label: input.label,
                confidence: input.confidence,
                notes: input.notes.trim(),
              }),
            },
          ],
          // Keep the local report concise enough for slower hardware and avoid
          // letting an instruct model produce an unbounded narrative.
          options: { temperature: 0.2, num_predict: 400 },
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!ollamaResponse.ok) {
        return sendJson(response, 200, {
          generatedByLLM: false,
          pesticideRows,
          message: "The local report model is unavailable. Use the conservative screening guidance shown in the app.",
        });
      }
      const result = await ollamaResponse.json();
      const report = parseDiagnosisReport(result?.message?.content, input.language);
      return sendJson(response, 200, { generatedByLLM: true, pesticideRows, report });
    } catch {
      return sendJson(response, 200, {
        generatedByLLM: false,
        pesticideRows,
        message: "The local report model is unavailable. Use the conservative screening guidance shown in the app.",
      });
    }
  } catch {
    return sendJson(response, 400, { error: "Please send a valid diagnosis report request." });
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return sendJson(response, 200, {
      ok: true,
      diseaseModelConnected: false,
      reportModelConfigured: Boolean(process.env.OLLAMA_MODEL?.trim()),
    });
  }

  if (url.pathname === "/api/diagnosis-report" && request.method === "POST") {
    return handleDiagnosisReport(request, response);
  }

  if (url.pathname === "/api/tts" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 10_000) {
        return sendJson(response, 413, { error: "Speech text is too large." });
      }
    }

    try {
      const input = JSON.parse(body || "{}");
      if (!input || !hasLanguage(input.language) || typeof input.text !== "string" || !input.text.trim() || input.text.length > 2000) {
        return sendJson(response, 400, { error: "A supported language and speech text are required." });
      }

      const audio = await renderLocalSpeech(input.language, input.text.trim());
      if (!audio) return sendJson(response, 501, { error: "Local speech is unavailable for this language or platform." });
      response.writeHead(200, {
        "content-type": "audio/wav",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(audio);
      return;
    } catch {
      return sendJson(response, 503, { error: "Local speech generation failed." });
    }
  }

  if (url.pathname === "/api/intake" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 10_000) {
        return sendJson(response, 413, { error: "Intake payload is too large." });
      }
    }

    try {
      const intake = JSON.parse(body || "{}");
      if (!intake || !hasLanguage(intake.language) || typeof intake.symptoms !== "string" || !intake.symptoms.trim()) {
        return sendJson(response, 400, { error: "Language and symptom text are required." });
      }

      return sendJson(response, 200, {
        received: true,
        diseaseModelConnected: false,
        language: intake.language,
        message: messages[intake.language].ready,
      });
    } catch {
      return sendJson(response, 400, { error: "Please send a valid JSON intake." });
    }
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const runtimeFiles = new Set([
    "/vendor/ort.wasm.min.js",
    "/vendor/ort-wasm-simd-threaded.wasm",
    "/vendor/ort-wasm-simd-threaded.mjs",
  ]);
  const filePath = runtimeFiles.has(requestedPath)
    ? resolve(runtimeDir, requestedPath.split("/").at(-1))
    : resolve(publicDir, `.${requestedPath}`);
  const allowedRoot = runtimeFiles.has(requestedPath) ? runtimeDir : publicDir;
  if (!filePath.startsWith(`${allowedRoot}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

export function createAppServer() {
  return createServer(handleRequest);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createAppServer().listen(port, host, () => {
    console.log(`KhetSuno prototype running at http://localhost:${port}`);
  });
}
