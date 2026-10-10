import { hasLanguage, messages } from "./languages.js";
import { createOfflineClassifier } from "./onnx-model.js";
import { initSoilAssessment } from "./soil-assessment.js";

export function initVoiceFlow({
  document = globalThis.document,
  window = globalThis.window,
  fetch = globalThis.fetch,
  createClassifier = createOfflineClassifier,
} = {}) {
  const languageSelect = document.querySelector("#language");
  const recordButton = document.querySelector("#record-button");
  const recordLabel = document.querySelector("#record-label");
  const voiceHint = document.querySelector("#voice-hint");
  const symptomsField = document.querySelector("#symptoms");
  const transcriptLabel = document.querySelector("#transcript-label");
  const photoInput = document.querySelector("#crop-photo");
  const photoPreview = document.querySelector("#photo-preview");
  const photoCopy = document.querySelector(".photo-copy");
  const analyzeButton = document.querySelector("#analyze-button");
  const modelStatus = document.querySelector("#model-status");
  const diagnosisCard = document.querySelector("#diagnosis");
  const diagnosisTitle = document.querySelector("#diagnosis-title");
  const diagnosisAlternatives = document.querySelector("#diagnosis-alternatives");
  const connectionStatus = document.querySelector("#connection-status");
  const submitButton = document.querySelector("#submit-button");
  const resultCard = document.querySelector("#result");
  const resultMessage = document.querySelector("#result-message");
  const speakResultButton = document.querySelector("#speak-result");
  const playbackHint = document.querySelector("#playback-hint");
  const voiceAvailability = document.querySelector("#voice-availability");
  const testVoiceButton = document.querySelector("#test-voice");
  const voiceSample = document.querySelector("#voice-sample");
  const voiceTestHint = document.querySelector("#voice-test-hint");
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  let language = languageSelect.value;
  if (!hasLanguage(language)) throw new Error("Unsupported UI language; select a supported language.");
  let recognitionSession = null;
  let pendingRequest = null;
  let currentResult = null;
  let activeUtterance = null;
  let waitingForVoice = null;
  let voiceTestResult = null;
  let playbackTimer = null;
  let photoUrl = null;
  let localSpeechRequest = null;
  let activeAudio = null;
  let activeAudioUrl = null;
  let classifyImage = null;
  let analysisVersion = 0;

  function updateConnectionStatus() {
    const online = window.navigator?.onLine !== false;
    connectionStatus.textContent = online ? "Online · offline app available" : "Offline · on-device checks available";
    connectionStatus.setAttribute("data-online", String(online));
  }

  updateConnectionStatus();
  window.addEventListener?.("online", updateConnectionStatus);
  window.addEventListener?.("offline", updateConnectionStatus);
  window.navigator?.serviceWorker?.register("/sw.js").catch(() => {
    connectionStatus.textContent = "Offline install requires a secure connection";
  });

  function updateControls() {
    const copy = messages[language];
    recordButton.setAttribute("aria-pressed", String(Boolean(recognitionSession)));
    recordLabel.textContent = recognitionSession ? copy.stopListening : copy.tapToSpeak;
    recordButton.disabled = Boolean(pendingRequest);
    submitButton.disabled = Boolean(recognitionSession || pendingRequest);
    submitButton.querySelector("span:first-child").textContent = pendingRequest ? copy.submitting : copy.submit;
    symptomsField.readOnly = Boolean(pendingRequest);
    testVoiceButton.disabled = Boolean(recognitionSession || pendingRequest);
  }

  function clearPlaybackTimer() {
    if (playbackTimer !== null) window.clearTimeout(playbackTimer);
    playbackTimer = null;
  }

  function cancelSpeech() {
    clearPlaybackTimer();
    activeUtterance = null;
    waitingForVoice = null;
    localSpeechRequest?.abort();
    localSpeechRequest = null;
    if (activeAudio) {
      activeAudio.onplay = null;
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.pause();
      activeAudio = null;
    }
    if (activeAudioUrl) {
      window.URL.revokeObjectURL(activeAudioUrl);
      activeAudioUrl = null;
    }
    window.speechSynthesis?.cancel();
    playbackHint.textContent = "";
    voiceTestHint.textContent = "";
  }

  function clearResult() {
    cancelSpeech();
    currentResult = null;
    voiceTestResult = null;
    resultCard.hidden = true;
    resultMessage.textContent = "";
    playbackHint.textContent = "";
  }

  function matchingVoice(locale) {
    const normalize = (tag) => tag.toLowerCase().replaceAll("_", "-");
    try {
      const voices = window.speechSynthesis?.getVoices() || [];
      const exact = voices.find((voice) => normalize(voice.lang) === normalize(locale));
      // A regional variant of the SAME language is acceptable; never use a default/other-language voice.
      return exact || voices.find((voice) => normalize(voice.lang).split("-")[0] === locale.split("-")[0]);
    } catch {
      return null;
    }
  }

  function updateVoiceAvailability() {
    const available = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance && matchingVoice(language));
    voiceAvailability.textContent = messages[language][available ? "voiceReady" : "voiceUnavailable"];
  }

  function isCurrentResult(result) {
    return result && (result === currentResult || result === voiceTestResult) && result.language === language;
  }

  async function speakLocally(result, hint, fallbackToBrowser = true) {
    if (!isCurrentResult(result)) return;
    if (!window.Audio) {
      if (fallbackToBrowser) speakBrowser(result, hint);
      else {
        hint.textContent = messages[result.language].playbackUnavailable;
        waitingForVoice = { result, hint };
      }
      return;
    }

    cancelSpeech();
    const request = new AbortController();
    localSpeechRequest = request;
    const copy = messages[result.language];
    const isCurrent = () => localSpeechRequest === request && !request.signal.aborted && isCurrentResult(result);
    hint.textContent = copy.playbackStarting;

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: result.language, text: result.text }),
        signal: request.signal,
      });
      if (!isCurrent()) return;
      if (!response.ok) throw new Error("Local speech is unavailable.");

      const url = window.URL.createObjectURL(await response.blob());
      if (!isCurrent()) {
        window.URL.revokeObjectURL(url);
        return;
      }
      const audio = new window.Audio(url);
      activeAudio = audio;
      activeAudioUrl = url;
      const releaseAudio = () => {
        if (activeAudio !== audio) return;
        activeAudio = null;
        if (activeAudioUrl) window.URL.revokeObjectURL(activeAudioUrl);
        activeAudioUrl = null;
        localSpeechRequest = null;
      };
      audio.onplay = () => {
        if (isCurrentResult(result) && activeAudio === audio) hint.textContent = copy.playbackPlaying;
      };
      audio.onended = () => {
        if (!isCurrentResult(result) || activeAudio !== audio) return;
        releaseAudio();
        hint.textContent = copy.playbackFinished;
      };
      audio.onerror = () => {
        if (!isCurrentResult(result) || activeAudio !== audio) return;
        releaseAudio();
        if (fallbackToBrowser) speakBrowser(result, hint);
        else hint.textContent = copy.playbackFailed;
      };
      const playback = audio.play();
      if (playback?.catch) {
        playback.catch(() => {
          if (!isCurrentResult(result) || activeAudio !== audio) return;
          releaseAudio();
          if (fallbackToBrowser) speakBrowser(result, hint);
          else hint.textContent = copy.playbackBlocked;
        });
      }
    } catch {
      if (!isCurrent()) return;
      localSpeechRequest = null;
      if (fallbackToBrowser) speakBrowser(result, hint);
      else hint.textContent = copy.playbackUnavailable;
    }
  }

  function speak(result, hint = playbackHint) {
    speakBrowser(result, hint);
  }

  function speakBrowser(result, hint = playbackHint) {
    const isCurrent = () => isCurrentResult(result);
    if (!isCurrent()) return;
    cancelSpeech();
    const copy = messages[result.language];
    const voice = matchingVoice(result.language);
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance || !voice) {
      void speakLocally(result, hint, false);
      return;
    }

    hint.textContent = copy.playbackStarting;
    try {
      const utterance = new window.SpeechSynthesisUtterance(result.text);
      utterance.lang = result.language;
      utterance.voice = voice;
      utterance.volume = 1;
      activeUtterance = utterance;
      utterance.onstart = () => {
        if (activeUtterance !== utterance || !isCurrent()) return;
        clearPlaybackTimer();
        hint.textContent = copy.playbackPlaying;
      };
      utterance.onerror = (event) => {
        if (activeUtterance !== utterance || !isCurrent()) return;
        clearPlaybackTimer();
        activeUtterance = null;
        const unavailable = ["language-unavailable", "voice-unavailable", "synthesis-unavailable"].includes(event.error);
        if (event.error !== "not-allowed" && window.Audio) {
          void speakLocally(result, hint, false);
          return;
        }
        hint.textContent = event.error === "not-allowed" ? copy.playbackBlocked
          : unavailable ? copy.playbackUnavailable : copy.playbackFailed;
      };
      utterance.onend = () => {
        if (activeUtterance !== utterance || !isCurrent()) return;
        clearPlaybackTimer();
        activeUtterance = null;
        hint.textContent = copy.playbackFinished;
      };
      // Some engines silently stall without emitting either start or error.
      playbackTimer = window.setTimeout(() => {
        if (activeUtterance !== utterance || !isCurrent()) return;
        if (window.Audio) void speakLocally(result, hint, false);
        else {
          cancelSpeech();
          hint.textContent = copy.playbackStalled;
        }
      }, 8000);
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      clearPlaybackTimer();
      activeUtterance = null;
      hint.textContent = error.name === "NotAllowedError" ? copy.playbackBlocked : copy.playbackFailed;
    }
  }

  function showResult(text, locale) {
    currentResult = { text, language: locale };
    resultCard.lang = locale;
    resultMessage.textContent = text;
    resultCard.hidden = false;
    speak(currentResult);
  }

  function discardRecognition() {
    const session = recognitionSession;
    recognitionSession = null; // Invalidate callbacks BEFORE abort(), which may fire events synchronously.
    session?.instance.abort();
    updateControls();
  }

  function applyLanguage(hint) {
    const copy = messages[language];
    for (const element of [recordButton, voiceHint, symptomsField, transcriptLabel, submitButton, resultCard, voiceAvailability, testVoiceButton, voiceSample, voiceTestHint]) {
      element.lang = language;
    }
    transcriptLabel.textContent = copy.transcriptLabel;
    symptomsField.placeholder = copy.transcriptPlaceholder;
    document.querySelector("#result-label").textContent = copy.statusLabel;
    speakResultButton.textContent = copy.hearMessage;
    testVoiceButton.textContent = copy.testVoice;
    voiceSample.textContent = copy.voiceSample;
    photoCopy.querySelector("small").textContent = copy.photoPreview;
    photoCopy.querySelector("small").lang = language;
    voiceHint.textContent = hint || (SpeechRecognition ? copy.idle : copy.unsupported);
    updateControls();
    updateVoiceAvailability();
  }

  recordButton.addEventListener("click", () => {
    if (pendingRequest) return;
    if (recognitionSession) {
      try {
        recognitionSession.instance.stop();
      } catch {
        discardRecognition();
        voiceHint.textContent = messages[language].review;
      }
      return;
    }

    const copy = messages[language];
    clearResult();
    if (!SpeechRecognition) {
      voiceHint.textContent = copy.unsupported;
      symptomsField.focus();
      return;
    }

    try {
      const instance = new SpeechRecognition();
      const session = { instance, language, hasResult: false };
      recognitionSession = session;
      const isCurrent = () => recognitionSession === session && language === session.language;
      instance.lang = session.language;
      instance.continuous = false;
      instance.interimResults = true;
      instance.onresult = (event) => {
        if (!isCurrent()) return;
        let transcript = "";
        for (let i = 0; i < event.results.length; i += 1) transcript += `${event.results[i][0].transcript} `;
        symptomsField.value = transcript.trim();
        session.hasResult = true;
      };
      instance.onerror = (event) => {
        if (!isCurrent()) return;
        const key = event.error === "language-not-supported" ? "languageUnavailable"
          : ["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error) ? "permissionDenied" : "failed";
        discardRecognition();
        voiceHint.textContent = copy[key];
        symptomsField.focus();
      };
      instance.onend = () => {
        if (!isCurrent()) return;
        recognitionSession = null;
        updateControls();
        voiceHint.textContent = session.hasResult ? copy.review : copy.failed;
        symptomsField.focus();
      };
      voiceHint.textContent = copy.listening;
      updateControls();
      instance.start();
    } catch (error) {
      discardRecognition();
      voiceHint.textContent = error.name === "NotSupportedError" ? copy.languageUnavailable
        : ["NotAllowedError", "SecurityError"].includes(error.name) ? copy.permissionDenied : copy.failed;
      symptomsField.focus();
    }
  });

  // Editing takes ownership of the draft: late recognition events must not overwrite corrections.
  symptomsField.addEventListener("input", () => {
    discardRecognition();
    clearResult();
    voiceHint.textContent = messages[language].review;
  });

  languageSelect.addEventListener("change", () => {
    if (!hasLanguage(languageSelect.value)) {
      languageSelect.value = language; // The UI exposes only the supported allowlist.
      return;
    }
    if (languageSelect.value === language) return;
    discardRecognition();
    const request = pendingRequest;
    pendingRequest = null;
    request?.controller.abort();
    clearResult();
    language = languageSelect.value;
    const copy = messages[language];
    const hint = symptomsField.value.trim() ? copy.languageChanged : copy.idle;
    applyLanguage(SpeechRecognition ? hint : `${hint} ${copy.unsupported}`);
  });

  photoInput.addEventListener("change", () => {
    analysisVersion += 1;
    if (photoUrl) window.URL.revokeObjectURL(photoUrl);
    photoUrl = null;
    photoCopy.querySelector("strong").textContent = "Drop a leaf photo here";
    photoPreview.hidden = true;
    analyzeButton.disabled = true;
    diagnosisCard.hidden = true;
    diagnosisTitle.textContent = "";
    diagnosisAlternatives.replaceChildren();
    const file = photoInput.files?.[0];
    if (!file) {
      modelStatus.textContent = "Choose a leaf photo to begin an offline check.";
      return;
    }
    if (!file.type.startsWith("image/")) {
      photoInput.value = "";
      voiceHint.textContent = messages[language].invalidPhoto;
      modelStatus.textContent = "Choose a supported image file for an offline check.";
      return;
    }
    photoUrl = window.URL.createObjectURL(file);
    photoPreview.src = photoUrl;
    photoPreview.hidden = false;
    photoCopy.querySelector("strong").textContent = file.name;
    analyzeButton.disabled = false;
    modelStatus.textContent = "The photo stays on this phone. Check the leaf whenever you are ready.";
  });

  analyzeButton.addEventListener("click", async () => {
    const file = photoInput.files?.[0];
    if (!file || analyzeButton.disabled) return;

    const requestVersion = analysisVersion;
    analyzeButton.disabled = true;
    diagnosisCard.hidden = true;
    modelStatus.textContent = "Loading the on-device model and checking the photo…";
    try {
      classifyImage ??= createClassifier();
      const predictions = await classifyImage(file);
      if (requestVersion !== analysisVersion) return;
      const [best, ...alternatives] = predictions;
      const readableName = (label) => label.replaceAll("___", " · ").replaceAll("_", " ").replace(/\s+/g, " ").trim();
      diagnosisTitle.textContent = `${readableName(best.label)} · ${Math.round(best.confidence * 100)}%`;
      diagnosisAlternatives.replaceChildren(...alternatives.map((prediction) => {
        const item = document.createElement("li");
        item.textContent = `${readableName(prediction.label)} · ${Math.round(prediction.confidence * 100)}%`;
        return item;
      }));
      diagnosisCard.hidden = false;
      modelStatus.textContent = "Checked on this phone. The photo was not uploaded.";
    } catch (error) {
      if (requestVersion === analysisVersion) {
        modelStatus.textContent = error instanceof Error
          ? error.message
          : "The offline model could not check this photo.";
      }
    } finally {
      if (requestVersion === analysisVersion) analyzeButton.disabled = false;
    }
  });

  submitButton.addEventListener("click", async () => {
    if (recognitionSession || pendingRequest) return;
    const requestLanguage = language;
    const copy = messages[requestLanguage];
    const symptoms = symptomsField.value.trim();
    if (!symptoms || !photoInput.files?.length) {
      showResult(copy.empty, requestLanguage);
      return;
    }

    clearResult();
    const request = { language: requestLanguage, controller: new AbortController() };
    pendingRequest = request;
    updateControls();
    const isCurrent = () => pendingRequest === request && language === request.language;
    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: request.language, symptoms }),
        signal: request.controller.signal,
      });
      const payload = await response.json();
      if (!isCurrent()) return;
      if (!response.ok) {
        showResult(copy.requestFailed, request.language);
      } else if (payload?.language !== request.language) {
        showResult(copy.responseMismatch, request.language);
      } else if (payload.received !== true || payload.diseaseModelConnected !== false || typeof payload.message !== "string" || !payload.message.trim()) {
        showResult(copy.requestFailed, request.language);
      } else {
        showResult(payload.message, request.language);
      }
    } catch {
      if (isCurrent()) showResult(copy.requestFailed, request.language);
    } finally {
      if (isCurrent()) {
        pendingRequest = null;
        updateControls();
      }
    }
  });

  speakResultButton.addEventListener("click", () => speakLocally(currentResult, playbackHint));
  testVoiceButton.addEventListener("click", async () => {
    if (recognitionSession || pendingRequest) return;
    updateVoiceAvailability();
    voiceTestResult = { text: messages[language].voiceSample, language };
    // Prefer the local OS voice for this manual check; use browser speech if unavailable.
    await speakLocally(voiceTestResult, voiceTestHint);
  });
  window.speechSynthesis?.addEventListener("voiceschanged", () => {
    updateVoiceAvailability();
    if (waitingForVoice && matchingVoice(waitingForVoice.result.language)) speak(waitingForVoice.result, waitingForVoice.hint);
  });
  initSoilAssessment(document);
  applyLanguage();
}

if (typeof window !== "undefined" && typeof document !== "undefined") initVoiceFlow();
