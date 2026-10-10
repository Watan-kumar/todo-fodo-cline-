import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { hasLanguage, messages } from "./public/languages.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(root, "public");
const port = Number(process.env.PORT || 4173);
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
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
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

async function handleRequest(request, response) {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return sendJson(response, 200, { ok: true, diseaseModelConnected: false });
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
  const filePath = resolve(publicDir, `.${requestedPath}`);
  if (!filePath.startsWith(`${publicDir}${sep}`)) {
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
  createAppServer().listen(port, "127.0.0.1", () => {
    console.log(`KhetSuno prototype running at http://localhost:${port}`);
  });
}
