import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { initVoiceFlow } from "../public/app.js";
import { messages } from "../public/languages.js";

// Minimal DOM/Web Speech adapters keep these tests dependency-free. They exercise
// the same event handlers as the browser, including intentionally late callbacks.
class Element {
  value = "";
  textContent = "";
  hidden = false;
  disabled = false;
  readOnly = false;
  files = [];
  attributes = {};
  listeners = new Map();
  children = new Map();

  addEventListener(type, callback) {
    this.listeners.set(type, [...(this.listeners.get(type) || []), callback]);
  }

  async emit(type, event = {}) {
    for (const callback of this.listeners.get(type) || []) await callback(event);
  }

  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
  querySelector(selector) {
    if (!this.children.has(selector)) this.children.set(selector, new Element());
    return this.children.get(selector);
  }
  replaceChildren(...children) { this.childList = children; }
}

function setup({
  language = "hi-IN",
  recognition = true,
  prefixed = false,
  synthesis = true,
  nativeAudio = false,
  voices,
  fetch: fetchOverride,
  createClassifier,
  createPest,
  startError,
  speakError,
} = {}) {
  const elements = new Map();
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new Element());
      return elements.get(selector);
    },
    createElement() { return new Element(); },
  };
  const get = (selector) => document.querySelector(selector);
  get("#language").value = language;
  get("#result").hidden = true;
  const recognizers = [];
  class Recognition {
    constructor() { recognizers.push(this); }
    start() {
      if (startError) throw startError;
      this.started = true;
    }
    stop() { this.stopped = true; }
    abort() { this.aborted = true; }
    result(...segments) { this.onresult({ results: segments.map((transcript) => [{ transcript }]) }); }
  }
  let availableVoices = voices ?? Object.keys(messages).map((lang) => ({ lang, name: lang }));
  const speech = new Element();
  speech.spoken = [];
  speech.cancelCount = 0;
  speech.resumeCount = 0;
  speech.resume = () => { speech.resumeCount += 1; };
  speech.cancel = () => { speech.cancelCount += 1; };
  speech.getVoices = () => availableVoices;
  speech.speak = (utterance) => {
    if (speakError) throw speakError;
    speech.spoken.push(utterance);
  };
  const timers = new Map();
  let timerId = 0;
  const audios = [];
  const window = {
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    URL: { createObjectURL: () => "blob:preview", revokeObjectURL: () => {} },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
  };
  if (nativeAudio) {
    window.Audio = class {
      constructor(url) { this.url = url; audios.push(this); }
      play() { this.onplay?.(); return Promise.resolve(); }
      pause() { this.paused = true; }
    };
  }
  if (recognition) window[prefixed ? "webkitSpeechRecognition" : "SpeechRecognition"] = Recognition;
  if (synthesis) window.speechSynthesis = speech;
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, ...options });
    if (fetchOverride) return fetchOverride(url, options);
    const { language: locale } = JSON.parse(options.body);
    return response({ received: true, diseaseModelConnected: false, language: locale, message: messages[locale].ready });
  };
  initVoiceFlow({ document, window, fetch, createClassifier, createPest });
  return {
    get, recognizers, speech, requests, window, timers, audios,
    fireTimers: () => {
      const callbacks = [...timers.values()];
      timers.clear();
      for (const callback of callbacks) callback();
    },
    setVoices: (next) => { availableVoices = next; },
    changeLanguage: async (next) => {
      get("#language").value = next;
      await get("#language").emit("change");
    },
    fill: (text = "typed symptoms") => {
      get("#symptoms").value = text;
      get("#crop-photo").files = [{ name: "leaf.png", type: "image/png" }];
    },
  };
}

function response(payload, ok = true) {
  return { ok, json: async () => payload, blob: async () => ({ type: "audio/wav" }) };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("selected leaf photos are classified locally without sending a request", async () => {
  const photo = { name: "leaf.png", type: "image/png" };
  let classifiedPhoto;
  let loads = 0;
  const app = setup({
    createClassifier: () => {
      loads += 1;
      return async (file) => {
        classifiedPhoto = file;
        return [
          { label: "Tomato___Late_blight", confidence: 0.76 },
          { label: "Tomato___healthy", confidence: 0.18 },
          { label: "Tomato___Early_blight", confidence: 0.06 },
        ];
      };
    },
  });
  app.get("#crop-photo").files = [photo];
  await app.get("#crop-photo").emit("change");
  assert.equal(app.get("#analyze-button").disabled, false);
  await app.get("#analyze-button").emit("click");

  assert.equal(loads, 1);
  assert.equal(classifiedPhoto, photo);
  assert.equal(app.requests.length, 0);
  assert.equal(app.get("#diagnosis").hidden, false);
  assert.match(app.get("#diagnosis-title").textContent, /Tomato · Late blight · 76%/);
  assert.equal(app.get("#diagnosis-alternatives").childList.length, 2);
  assert.match(app.get("#model-status").textContent, /not uploaded/i);
  assert.match(app.get("#diagnosis-advice").textContent, /गीले पौधों को न छुएँ/);
  assert.match(app.get("#result-message").textContent, /स्थानीय कृषि अधिकारी से पुष्टि करें/);
  assert.equal(app.speech.spoken.at(-1).lang, "hi-IN");

  app.get("#symptoms").value = queries["hi-IN"][1];
  await app.get("#symptoms").emit("input");
  await app.get("#submit-button").emit("click");
  assert.equal(app.requests.length, 0, "the scanned signal uses the local guide without a network request");
  assert.match(app.get("#result-message").textContent, /सलाह के बिना छिड़काव न करें/);
  assert.equal(app.speech.spoken.at(-1).lang, "hi-IN");
});

test("pest scan returns translated local advice in the voice assistant", async () => {
  const app = setup({
    language: "mr-IN",
    createPest: () => async () => [{ label: "predators", confidence: 0.9 }],
  });
  app.get("#pest-photo").files = [{ name: "insect.jpg", type: "image/jpeg" }];
  await app.get("#pest-photo").emit("change");
  await app.get("#analyze-pest").emit("click");

  assert.equal(app.get("#pest-diagnosis").hidden, false);
  assert.match(app.get("#pest-diagnosis-title").textContent, /predators · 90%/);
  assert.match(app.get("#pest-diagnosis-advice").textContent, /हा उपयुक्त किंवा सामान्य कीटक/);
  assert.match(app.get("#result-message").textContent, /त्याला मारू नका/);
  assert.equal(app.speech.spoken.at(-1).lang, "mr-IN");
  assert.equal(app.requests.length, 0);
});

const queries = {
  "hi-IN": ["टमाटर के पत्ते", "टमाटर के पत्तों पर पीले धब्बे हैं।"],
  "te-IN": ["టమాటా ఆకులు", "టమాటా ఆకులపై పసుపు మచ్చలు ఉన్నాయి."],
  "ta-IN": ["தக்காளி இலைகள்", "தக்காளி இலைகளில் மஞ்சள் புள்ளிகள் உள்ளன."],
  "kn-IN": ["ಟೊಮೇಟೊ ಎಲೆಗಳು", "ಟೊಮೇಟೊ ಎಲೆಗಳ ಮೇಲೆ ಹಳದಿ ಕಲೆಗಳಿವೆ."],
  "ml-IN": ["തക്കാളി ഇലകൾ", "തക്കാളി ഇലകളിൽ മഞ്ഞ പാടുകളുണ്ട്."],
  "mr-IN": ["टोमॅटोची पाने", "टोमॅटोच्या पानांवर पिवळे डाग आहेत."],
};

for (const language of Object.keys(messages)) {
  test(`${language}: recognition → editable review → explicit submit → matching displayed/spoken response`, async () => {
    const app = setup();
    await app.changeLanguage(language);
    const copy = messages[language];
    assert.equal(app.get("#transcript-label").textContent, copy.transcriptLabel);
    assert.equal(app.get("#symptoms").lang, language);
    await app.get("#record-button").emit("click");
    const recognition = app.recognizers[0];
    assert.equal(recognition.lang, language);
    assert.equal(recognition.started, true);
    assert.equal(app.get("#voice-hint").textContent, copy.listening);
    assert.equal(app.get("#submit-button").disabled, true);
    recognition.result(queries[language][0]);
    assert.equal(app.get("#symptoms").value, queries[language][0]);
    assert.equal(app.get("#symptoms").readOnly, false);
    await app.get("#submit-button").emit("click");
    assert.equal(app.requests.length, 0, "cannot submit while still recognizing");
    recognition.onend();
    assert.equal(app.get("#voice-hint").textContent, copy.review);
    assert.equal(app.get("#submit-button").disabled, false);
    assert.equal(app.requests.length, 0, "recognition never auto-submits");
    app.fill(queries[language][1]);
    await app.get("#symptoms").emit("input");
    await app.get("#submit-button").emit("click");
    assert.deepEqual(JSON.parse(app.requests[0].body), { language, symptoms: queries[language][1] });
    assert.equal(app.get("#result-message").textContent, copy.ready);
    assert.equal(app.get("#result-label").textContent, copy.statusLabel);
    assert.equal(app.get("#result").lang, language);
    assert.equal(app.get("#result").hidden, false);
    assert.equal(app.speech.spoken.length, 1);
    assert.equal(app.speech.spoken[0].lang, language);
    assert.equal(app.speech.spoken[0].voice.lang, language);
    assert.equal(app.speech.spoken[0].text, app.get("#result-message").textContent);
    await app.get("#speak-result").emit("click");
    assert.equal(app.speech.spoken[1].text, copy.ready);
    assert.equal(app.speech.spoken[1].lang, language);
  });

  test(`${language}: unsupported recognition and playback offer localized text fallbacks`, async () => {
    const app = setup({ language, recognition: false, voices: [{ lang: "en-US", default: true }] });
    assert.equal(app.get("#voice-hint").textContent, messages[language].unsupported);
    await app.get("#record-button").emit("click");
    assert.equal(app.get("#symptoms").focused, true);
    app.fill(queries[language][1]);
    await app.get("#submit-button").emit("click");
    assert.equal(app.get("#playback-hint").textContent, messages[language].playbackUnavailable);
    assert.equal(app.speech.spoken.length, 0, "must not speak with the default English voice");
    assert.equal(app.get("#result-message").textContent, messages[language].ready);
    assert.equal(app.get("#language").value, language);
  });
}

test("the HTML language options and translation catalogs stay in sync", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const languageSelect = html.match(/<select id="language"[\s\S]*?<\/select>/)?.[0] || "";
  const options = [...languageSelect.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(options, Object.keys(messages));
  assert.match(html, /<label id="transcript-label"[^>]+for="symptoms"/);
  assert.match(html, /<textarea id="symptoms"[^>]+aria-describedby="voice-hint"/);
  for (const copy of Object.values(messages)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(messages["hi-IN"]).sort());
    for (const value of Object.values(copy)) assert.ok(typeof value === "string" && value.trim());
  }
});

test("manual edits cancel active recognition and survive late results/errors/end events", async () => {
  const app = setup();
  await app.get("#record-button").emit("click");
  const recognition = app.recognizers[0];
  recognition.result("initial", "draft");
  assert.equal(app.get("#symptoms").value, "initial draft");
  app.get("#symptoms").value = "manual correction";
  await app.get("#symptoms").emit("input");
  recognition.result("stale speech");
  recognition.onerror({ error: "network" });
  recognition.onend();
  assert.equal(recognition.aborted, true);
  assert.equal(app.get("#symptoms").value, "manual correction");
  assert.equal(app.get("#voice-hint").textContent, messages["hi-IN"].review);
  assert.equal(app.get("#submit-button").disabled, false);
});

test("tap to stop waits for final results and then enables review/submission", async () => {
  const app = setup({ prefixed: true });
  await app.get("#record-button").emit("click");
  const recognition = app.recognizers[0];
  await app.get("#record-button").emit("click");
  assert.equal(recognition.stopped, true);
  assert.equal(app.get("#submit-button").disabled, true);
  recognition.result("final transcript");
  recognition.onend();
  assert.equal(app.get("#symptoms").value, "final transcript");
  assert.equal(app.get("#submit-button").disabled, false);
});

test("language changes abort recognition, preserve editable drafts with a notice, and ignore old callbacks", async () => {
  const app = setup();
  await app.get("#record-button").emit("click");
  const old = app.recognizers[0];
  old.result("existing draft");
  await app.changeLanguage("te-IN");
  assert.equal(old.aborted, true);
  assert.equal(app.get("#symptoms").value, "existing draft");
  assert.equal(app.get("#voice-hint").textContent, messages["te-IN"].languageChanged);
  await app.get("#record-button").emit("click");
  const current = app.recognizers[1];
  assert.equal(current.lang, "te-IN");
  old.result("stale Hindi");
  old.onerror({ error: "language-not-supported" });
  old.onend();
  assert.equal(app.get("#symptoms").value, "existing draft");
  assert.equal(app.get("#record-button").attributes["aria-pressed"], "true");
  assert.equal(app.get("#voice-hint").textContent, messages["te-IN"].listening);
});

for (const [error, key] of [["language-not-supported", "languageUnavailable"], ["not-allowed", "permissionDenied"], ["audio-capture", "permissionDenied"], ["network", "failed"], ["no-speech", "failed"]]) {
  test(`recognition ${error} offers a localized fallback without changing language`, async () => {
    const app = setup({ language: "ta-IN" });
    await app.get("#record-button").emit("click");
    app.recognizers[0].onerror({ error });
    app.recognizers[0].onend();
    assert.equal(app.get("#voice-hint").textContent, messages["ta-IN"][key]);
    assert.equal(app.get("#language").value, "ta-IN");
    assert.equal(app.get("#submit-button").disabled, false);
    assert.equal(app.requests.length, 0);
  });
}

test("recognition start exceptions restore usable typing controls", async () => {
  const app = setup({ startError: new Error("failed to start") });
  await app.get("#record-button").emit("click");
  assert.equal(app.get("#voice-hint").textContent, messages["hi-IN"].failed);
  assert.equal(app.get("#submit-button").disabled, false);
});

test("a synchronous unsupported-language error explains unavailability rather than switching languages", async () => {
  const app = setup({ language: "kn-IN", startError: new DOMException("Language not supported", "NotSupportedError") });
  await app.get("#record-button").emit("click");
  assert.equal(app.get("#voice-hint").textContent, messages["kn-IN"].languageUnavailable);
  assert.equal(app.get("#language").value, "kn-IN");
  assert.equal(app.get("#submit-button").disabled, false);
});

test("changing language cancels a request; stale responses cannot replace or speak a newer result", async () => {
  const first = deferred();
  const second = deferred();
  const queue = [first, second];
  const app = setup({ fetch: () => queue.shift().promise });
  app.fill();
  const oldSubmit = app.get("#submit-button").emit("click");
  assert.equal(app.get("#record-button").disabled, true);
  assert.equal(app.get("#symptoms").readOnly, true);
  await app.get("#submit-button").emit("click");
  assert.equal(app.requests.length, 1, "duplicate requests are ignored");
  await app.changeLanguage("ml-IN");
  assert.equal(app.requests[0].signal.aborted, true);
  assert.equal(app.get("#symptoms").readOnly, false);
  const newSubmit = app.get("#submit-button").emit("click");
  first.resolve(response({ language: "hi-IN", message: messages["hi-IN"].ready, received: true, diseaseModelConnected: false }));
  await oldSubmit;
  assert.equal(app.get("#submit-button").disabled, true, "old finally must not unlock new request");
  assert.equal(app.speech.spoken.length, 0);
  second.resolve(response({ language: "ml-IN", message: messages["ml-IN"].ready, received: true, diseaseModelConnected: false }));
  await newSubmit;
  assert.equal(app.get("#result-message").textContent, messages["ml-IN"].ready);
  assert.equal(app.speech.spoken.length, 1);
  assert.equal(app.speech.spoken[0].lang, "ml-IN");
});

test("completed results and queued speech are cleared rather than replayed in a new language", async () => {
  const app = setup();
  app.fill();
  await app.get("#submit-button").emit("click");
  const oldUtterance = app.speech.spoken[0];
  const cancellations = app.speech.cancelCount;
  await app.changeLanguage("mr-IN");
  assert.ok(app.speech.cancelCount > cancellations);
  assert.equal(app.get("#result").hidden, true);
  assert.equal(app.get("#result-message").textContent, "");
  oldUtterance.onerror({ error: "canceled" });
  assert.equal(app.get("#playback-hint").textContent, "");
  await app.get("#speak-result").emit("click");
  assert.equal(app.speech.spoken.length, 1);
});

test("missing speech synthesis still displays the localized response", async () => {
  const app = setup({ synthesis: false, language: "kn-IN" });
  app.fill();
  await app.get("#submit-button").emit("click");
  assert.equal(app.get("#result-message").textContent, messages["kn-IN"].ready);
  assert.equal(app.get("#playback-hint").textContent, messages["kn-IN"].playbackUnavailable);
});

test("voices loaded asynchronously trigger only the current matching-language playback", async () => {
  const app = setup({ voices: [] });
  app.fill();
  await app.get("#submit-button").emit("click");
  assert.equal(app.speech.spoken.length, 0);
  app.setVoices([{ lang: "en-US" }]);
  await app.speech.emit("voiceschanged");
  assert.equal(app.speech.spoken.length, 0);
  app.setVoices([{ lang: "hi-IN" }]);
  await app.speech.emit("voiceschanged");
  assert.equal(app.speech.spoken[0].lang, "hi-IN");
  assert.equal(app.get("#playback-hint").textContent, messages["hi-IN"].playbackStarting);
  await app.speech.emit("voiceschanged");
  assert.equal(app.speech.spoken.length, 1, "voiceschanged must not repeat playback");
});

test("late voices after a language change do not speak the old response", async () => {
  const app = setup({ voices: [] });
  app.fill();
  await app.get("#submit-button").emit("click");
  await app.changeLanguage("te-IN");
  app.setVoices([{ lang: "hi-IN" }]);
  await app.speech.emit("voiceschanged");
  assert.equal(app.speech.spoken.length, 0);
});

test("voice matching prefers exact locale and only permits the same base language", async () => {
  const app = setup({ voices: [{ lang: "en-IN", default: true }, { lang: "hi" }, { lang: "HI_in" }] });
  app.fill();
  await app.get("#submit-button").emit("click");
  assert.equal(app.speech.spoken[0].voice.lang, "HI_in");
  app.setVoices([{ lang: "en-IN" }, { lang: "hi" }]);
  await app.get("#speak-result").emit("click");
  assert.equal(app.speech.spoken[1].voice.lang, "hi");
  assert.equal(app.speech.spoken[1].lang, "hi-IN");
});

test("speech output errors and thrown speak calls retain the readable text and offer retry", async () => {
  for (const speakError of [undefined, new Error("synthesis unavailable")]) {
    const app = setup({ speakError, language: "mr-IN" });
    app.fill();
    await app.get("#submit-button").emit("click");
    if (!speakError) app.speech.spoken[0].onerror({ error: "synthesis-failed" });
    assert.equal(app.get("#playback-hint").textContent, messages["mr-IN"].playbackFailed);
    assert.equal(app.get("#result-message").textContent, messages["mr-IN"].ready);
  }
});

test("a voice advertised as available may still fail with a localized unavailable-language explanation", async () => {
  const app = setup({ language: "ta-IN" });
  app.fill();
  await app.get("#submit-button").emit("click");
  app.speech.spoken[0].onerror({ error: "language-unavailable" });
  assert.equal(app.get("#playback-hint").textContent, messages["ta-IN"].playbackUnavailable);
  assert.equal(app.get("#result-message").textContent, messages["ta-IN"].ready);
  assert.equal(app.get("#language").value, "ta-IN");
  assert.equal(app.speech.spoken.length, 1, "no retry in another language");
});

test("validation, HTTP errors, network failures and response mismatches stay in the selected language", async () => {
  const language = "te-IN";
  const cases = [
    { fetch: async () => response({ error: "Internal server error" }, false), key: "requestFailed" },
    { fetch: async () => { throw new Error("Network offline"); }, key: "requestFailed" },
    { fetch: async () => ({ ok: true, json: async () => { throw new Error("Invalid JSON"); } }), key: "requestFailed" },
    { fetch: async () => response({ language: "hi-IN", message: messages["hi-IN"].ready }), key: "responseMismatch" },
    { fetch: async () => response({ message: "English response" }), key: "responseMismatch" },
    { fetch: async () => response({ language, message: "", received: true, diseaseModelConnected: false }), key: "requestFailed" },
    { fetch: async () => response({ language, message: "Fabricated diagnosis", received: true, diseaseModelConnected: true }), key: "requestFailed" },
  ];
  for (const { fetch, key } of cases) {
    const app = setup({ language, fetch });
    app.fill();
    await app.get("#submit-button").emit("click");
    assert.equal(app.get("#result-message").textContent, messages[language][key]);
    assert.equal(app.speech.spoken[0].text, messages[language][key]);
    assert.equal(app.speech.spoken[0].lang, language);
    assert.equal(app.get("#submit-button").disabled, false);
  }
  const app = setup({ language });
  await app.get("#submit-button").emit("click");
  assert.equal(app.requests.length, 0);
  assert.equal(app.get("#result-message").textContent, messages[language].empty);
  assert.equal(app.speech.spoken[0].lang, language);
});

for (const language of Object.keys(messages)) {
  test(`${language}: voice can be tested without a microphone, photo, or crop request`, async () => {
    const app = setup({ language, recognition: false });
    assert.equal(app.get("#voice-availability").textContent, messages[language].voiceReady);
    assert.equal(app.get("#voice-availability").lang, language);
    assert.equal(app.get("#test-voice").textContent, messages[language].testVoice);
    await app.get("#test-voice").emit("click");
    assert.equal(app.requests.length, 0);
    assert.equal(app.recognizers.length, 0);
    assert.equal(app.get("#result").hidden, true);
    const utterance = app.speech.spoken[0];
    assert.equal(utterance.text, app.get("#voice-sample").textContent);
    assert.equal(utterance.text, messages[language].voiceSample);
    assert.equal(utterance.lang, language);
    assert.equal(utterance.voice.lang, language);
    assert.equal(utterance.volume, 1);
    assert.equal(app.speech.resumeCount, 1);
    assert.equal(app.get("#voice-test-hint").textContent, messages[language].playbackStarting);
    utterance.onstart();
    assert.equal(app.timers.size, 0);
    assert.equal(app.get("#voice-test-hint").textContent, messages[language].playbackPlaying);
    utterance.onend();
    assert.equal(app.get("#voice-test-hint").textContent, messages[language].playbackFinished);
  });
}

test("missing Marathi voice is explained BEFORE submission, with no Hindi/English fallback", async () => {
  const app = setup({ language: "mr-IN", voices: [{ lang: "hi-IN" }, { lang: "en-US" }] });
  assert.equal(app.get("#voice-availability").textContent, messages["mr-IN"].voiceUnavailable);
  await app.get("#test-voice").emit("click");
  assert.equal(app.get("#voice-test-hint").textContent, messages["mr-IN"].playbackUnavailable);
  assert.equal(app.speech.spoken.length, 0);
  assert.equal(app.requests.length, 0);
  assert.equal(app.get("#language").value, "mr-IN");
  app.setVoices([{ lang: "mr-IN" }]);
  await app.speech.emit("voiceschanged");
  assert.equal(app.get("#voice-availability").textContent, messages["mr-IN"].voiceReady);
  assert.equal(app.speech.spoken[0].lang, "mr-IN");
});

test("missing synthesis is explained before a crop request", async () => {
  const app = setup({ language: "mr-IN", synthesis: false });
  assert.equal(app.get("#voice-availability").textContent, messages["mr-IN"].voiceUnavailable);
  await app.get("#test-voice").emit("click");
  assert.equal(app.get("#voice-test-hint").textContent, messages["mr-IN"].playbackUnavailable);
  assert.equal(app.requests.length, 0);
});

test("browser-blocked playback explains the required click and retries only the same language", async () => {
  const app = setup({ language: "mr-IN" });
  app.fill();
  await app.get("#submit-button").emit("click");
  app.speech.spoken[0].onerror({ error: "not-allowed" });
  assert.equal(app.get("#playback-hint").textContent, messages["mr-IN"].playbackBlocked);
  assert.equal(app.timers.size, 0);
  await app.get("#speak-result").emit("click");
  assert.equal(app.speech.spoken[1].lang, "mr-IN");
  assert.equal(app.speech.spoken[1].text, messages["mr-IN"].ready);
  app.speech.spoken[1].onstart();
  assert.equal(app.get("#playback-hint").textContent, messages["mr-IN"].playbackPlaying);
});

test("a synchronous playback permission exception offers the same explicit-click fallback", async () => {
  const app = setup({ speakError: new DOMException("Blocked", "NotAllowedError") });
  await app.get("#test-voice").emit("click");
  assert.equal(app.get("#voice-test-hint").textContent, messages["hi-IN"].playbackBlocked);
  assert.equal(app.timers.size, 0);
});

test("silent playback stalls time out with guidance instead of looking successful", async () => {
  const app = setup();
  app.fill();
  await app.get("#submit-button").emit("click");
  const utterance = app.speech.spoken[0];
  app.fireTimers();
  assert.equal(app.get("#playback-hint").textContent, messages["hi-IN"].playbackStalled);
  assert.equal(app.get("#result-message").textContent, messages["hi-IN"].ready);
  utterance.onstart();
  utterance.onerror({ error: "canceled" });
  assert.equal(app.get("#playback-hint").textContent, messages["hi-IN"].playbackStalled);
});

test("changing language cancels voice checks and their timers/late callbacks", async () => {
  const app = setup();
  await app.get("#test-voice").emit("click");
  const old = app.speech.spoken[0];
  await app.changeLanguage("mr-IN");
  assert.equal(app.timers.size, 0);
  old.onstart();
  old.onend();
  app.fireTimers();
  assert.equal(app.get("#voice-test-hint").textContent, "");
  assert.equal(app.get("#voice-sample").textContent, messages["mr-IN"].voiceSample);
});

test("voice checks do not play over active recognition", async () => {
  const app = setup();
  await app.get("#record-button").emit("click");
  assert.equal(app.get("#test-voice").disabled, true);
  await app.get("#test-voice").emit("click");
  assert.equal(app.speech.spoken.length, 0);
  app.recognizers[0].onend();
  assert.equal(app.get("#test-voice").disabled, false);
});

test("manual voice test plays local WAV speech before using browser synthesis", async () => {
  const app = setup({
    language: "hi-IN",
    recognition: false,
    nativeAudio: true,
    fetch: async (url, options) => {
      assert.equal(url, "/api/tts");
      assert.equal(JSON.parse(options.body).language, "hi-IN");
      assert.equal(JSON.parse(options.body).text, messages["hi-IN"].voiceSample);
      return response({}, true);
    },
  });

  await app.get("#test-voice").emit("click");
  assert.equal(app.requests.length, 1);
  assert.equal(app.audios.length, 1);
  assert.equal(app.audios[0].url, "blob:preview");
  assert.equal(app.speech.spoken.length, 0);
  assert.equal(app.get("#voice-test-hint").textContent, messages["hi-IN"].playbackPlaying);
  app.audios[0].onended();
  assert.equal(app.get("#voice-test-hint").textContent, messages["hi-IN"].playbackFinished);
});

test("local speech unavailable falls back to the matching browser voice", async () => {
  const app = setup({
    language: "te-IN",
    recognition: false,
    nativeAudio: true,
    fetch: async () => response({ error: "Unavailable" }, false),
  });

  await app.get("#test-voice").emit("click");
  assert.equal(app.audios.length, 0);
  assert.equal(app.speech.spoken.length, 1);
  assert.equal(app.speech.spoken[0].lang, "te-IN");
});
