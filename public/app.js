import { hasLanguage, messages } from "./languages.js";
import { createOfflineClassifier, createPestClassifier } from "./onnx-model.js";
import { getLocalGuidance } from "./local-guidance.js";
import { INDIAN_STATES_AND_UTS } from "./states.js";
import { initSoilAssessment } from "./soil-assessment.js";

export function initVoiceFlow({
  document = globalThis.document,
  window = globalThis.window,
  fetch = globalThis.fetch,
  createClassifier = createOfflineClassifier,
  createPest = createPestClassifier,
  autoAnalyzeOnSubmit = true,
} = {}) {
  const languageSelect = document.querySelector("#language");
  const recordButton = document.querySelector("#record-button");
  const recordLabel = document.querySelector("#record-label");
  const voiceHint = document.querySelector("#voice-hint");
  const symptomsField = document.querySelector("#symptoms");
  const transcriptLabel = document.querySelector("#transcript-label");
  const photoInput = document.querySelector("#crop-photo");
  const pestPhotoInput = document.querySelector("#pest-photo");
  const photoPreview = document.querySelector("#photo-preview");
  const photoCopy = document.querySelector(".photo-copy");
  const analyzeButton = document.querySelector("#analyze-button");
  const modelStatus = document.querySelector("#model-status");
  const farmState = document.querySelector("#farm-state");
  const reportStatus = document.querySelector("#report-status");
  const reportContent = document.querySelector("#generated-report");
  const pesticideOptions = document.querySelector("#pesticide-options");
  const diagnosisCard = document.querySelector("#diagnosis");
  const diagnosisTitle = document.querySelector("#diagnosis-title");
  const diagnosisAlternatives = document.querySelector("#diagnosis-alternatives");
  const diagnosisAdvice = document.querySelector("#diagnosis-advice");
  const analyzePestButton = document.querySelector("#analyze-pest");
  const pestModelStatus = document.querySelector("#pest-model-status");
  const pestDiagnosis = document.querySelector("#pest-diagnosis");
  const pestDiagnosisTitle = document.querySelector("#pest-diagnosis-title");
  const pestDiagnosisAdvice = document.querySelector("#pest-diagnosis-advice");
  const connectionStatus = document.querySelector("#connection-status");
  const submitButton = document.querySelector("#submit-button");
  const resultCard = document.querySelector("#result");
  const resultMessage = document.querySelector("#result-message");
  const speakResultButton = document.querySelector("#speak-result");
  const pauseSpeechButton = document.querySelector("#pause-speech");
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
  let playbackActive = false;
  let playbackPaused = false;
  let waitingForVoice = null;
  let voiceTestResult = null;
  let playbackTimer = null;
  let photoUrl = null;
  let localSpeechRequest = null;
  let activeAudio = null;
  let activeAudioUrl = null;
  let audioStartTimer = null;
  let localTtsLanguages = new Set();
  let classifyImage = null;
  let classifyPest = null;
  let reportRequestVersion = 0;
  let analysisVersion = 0;
  let pestAnalysisVersion = 0;
  const localSignals = { disease: null, pest: null };

  function activeGuidance(locale = language) {
    return Object.entries(localSignals)
      .filter(([, prediction]) => prediction)
      .map(([source, prediction]) => getLocalGuidance({ source, ...prediction, language: locale }).text)
      .join(" ");
  }

  function activeSignal() {
    if (localSignals.disease) return localSignals.disease;
    if (localSignals.pest) return localSignals.pest;
    return null;
  }

  function showSignalGuidance(locale = language) {
    const text = activeGuidance(locale);
    const signal = activeSignal();
    if (text && signal) {
      const label = signal.label.replaceAll("___", " · ").replaceAll("_", " ").replace(/\s+/g, " ").trim();
      const score = Math.round(signal.confidence * 100);
      showResult(`${messages[locale].photoReply} ${label} · ${score}%. ${text}`, locale);
    }
    return Boolean(text);
  }

  function clearGeneratedReport({ preserveStatus = false } = {}) {
    reportRequestVersion += 1;
    if (!preserveStatus) reportStatus.textContent = "";
    reportContent.textContent = "";
    pesticideOptions.replaceChildren();
  }

  async function loadDiagnosisReport({ label, confidence, requestVersion, locale }) {
    if (confidence < 0.7) {
      reportStatus.textContent = "The score is below the preliminary 70% cutoff. Retake a clear close-up; this cutoff needs validation on local field photos.";
      return;
    }
    if (!farmState.value) {
      reportStatus.textContent = "Choose your state or union territory to check region-specific verified guidance. No product or dose will be shown without a verified record.";
      return;
    }

    const currentReportVersion = ++reportRequestVersion;
    const selectedState = farmState.value;
    reportStatus.textContent = "Checking verified crop and state records. The language model cannot add pesticide names or doses.";
    try {
      const response = await fetch("/api/diagnosis-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          language: locale,
          label,
          confidence,
          state: farmState.value,
          notes: symptomsField.value.trim(),
        }),
      });
      const payload = await response.json();
      if (requestVersion !== analysisVersion || currentReportVersion !== reportRequestVersion
        || selectedState !== farmState.value || locale !== language) return;
      if (!response.ok) {
        reportStatus.textContent = payload?.error || "The report could not be prepared.";
        return;
      }

      if (payload.report) {
        const report = payload.report;
        reportContent.textContent = [
          `Possible symptoms: ${report.symptoms}`,
          `Possible cause: ${report.possibleCause}`,
          `Prevention: ${report.prevention}`,
        ].join("\n\n");
      }
      pesticideOptions.replaceChildren(...(Array.isArray(payload.pesticideRows) ? payload.pesticideRows : []).map((row) => {
        const item = document.createElement("li");
        item.textContent = `${row.optionType === "organic" ? "Organic option" : "Registered chemical option"}: ${row.product}; dose: ${row.dose}; pre-harvest interval: ${row.preHarvestIntervalDays} days. Registration ${row.registrationNumber}. `;
        const source = document.createElement("a");
        source.href = row.sourceUrl;
        source.textContent = row.sourceTitle;
        source.rel = "noreferrer";
        item.appendChild(source);
        return item;
      }));
      if (!payload.pesticideRows?.length) {
        pesticideOptions.textContent = "No current, verified pesticide row matches this disease and state. No product or dose is recommended.";
      }
      reportStatus.textContent = payload.generatedByLLM
        ? "Report generated by the configured local language model. Confirm symptoms with an agricultural professional."
        : payload.message || "The local language model is unavailable; conservative photo guidance remains available.";
    } catch {
      if (requestVersion === analysisVersion && currentReportVersion === reportRequestVersion
        && selectedState === farmState.value && locale === language) {
        reportStatus.textContent = "The report service is unavailable. Conservative photo guidance remains available.";
      }
    }
  }

  function updateConnectionStatus() {
    const online = window.navigator?.onLine !== false;
    connectionStatus.textContent = online ? "Online · offline app available" : "Offline · on-device checks available";
    connectionStatus.setAttribute("data-online", String(online));
  }

  updateConnectionStatus();
  farmState.replaceChildren(
    Object.assign(document.createElement("option"), { value: "", textContent: "Choose state or union territory" }),
    ...INDIAN_STATES_AND_UTS.map((state) => Object.assign(document.createElement("option"), { value: state, textContent: state })),
  );
  farmState.addEventListener("change", () => {
    clearGeneratedReport({ preserveStatus: true });
    if (localSignals.disease) {
      void loadDiagnosisReport({
        ...localSignals.disease,
        requestVersion: analysisVersion,
        locale: language,
      });
    }
  });
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

  function updatePlaybackControl() {
    const copy = messages[currentResult?.language || language];
    pauseSpeechButton.textContent = playbackPaused ? copy.resumeVoice : copy.pauseVoice;
    pauseSpeechButton.disabled = !playbackActive;
  }

  function clearPlaybackTimer() {
    if (playbackTimer !== null) window.clearTimeout(playbackTimer);
    playbackTimer = null;
  }

  function clearAudioStartTimer() {
    if (audioStartTimer !== null) window.clearTimeout(audioStartTimer);
    audioStartTimer = null;
  }

  function cancelSpeech() {
    clearPlaybackTimer();
    clearAudioStartTimer();
    activeUtterance = null;
    playbackActive = false;
    playbackPaused = false;
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
    updatePlaybackControl();
  }

  function clearResult() {
    cancelSpeech();
    currentResult = null;
    voiceTestResult = null;
    resultCard.hidden = true;
    resultMessage.textContent = "";
    playbackHint.textContent = "";
    updatePlaybackControl();
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
    const browserVoice = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance && matchingVoice(language));
    const localVoice = Boolean(window.Audio && localTtsLanguages.has(language));
    const available = browserVoice || localVoice;
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
        clearAudioStartTimer();
        activeAudio = null;
        playbackActive = false;
        playbackPaused = false;
        if (activeAudioUrl) window.URL.revokeObjectURL(activeAudioUrl);
        activeAudioUrl = null;
        localSpeechRequest = null;
        updatePlaybackControl();
      };
      audio.onplay = () => {
        if (isCurrentResult(result) && activeAudio === audio) {
          clearAudioStartTimer();
          playbackActive = true;
          playbackPaused = false;
          hint.textContent = copy.playbackPlaying;
          updatePlaybackControl();
        }
      };
      audio.onpause = () => {
        if (isCurrentResult(result) && activeAudio === audio && playbackActive) {
          playbackPaused = true;
          hint.textContent = copy.playbackPaused;
          updatePlaybackControl();
        }
      };
      audio.onended = () => {
        if (!isCurrentResult(result) || activeAudio !== audio) return;
        releaseAudio();
        hint.textContent = copy.playbackFinished;
      };
      audio.onerror = () => {
        if (!isCurrentResult(result) || activeAudio !== audio) return;
        releaseAudio();
        if (fallbackToBrowser && matchingVoice(result.language)) speakBrowser(result, hint);
        else hint.textContent = copy.playbackFailed;
      };
      audioStartTimer = window.setTimeout(() => {
        if (activeAudio !== audio) return;
        releaseAudio();
        if (fallbackToBrowser && matchingVoice(result.language)) speakBrowser(result, hint);
        else hint.textContent = copy.playbackStalled;
      }, 8000);
      const playback = audio.play();
      if (playback?.catch) {
        playback.catch(() => {
          if (!isCurrentResult(result) || activeAudio !== audio) return;
          releaseAudio();
          if (fallbackToBrowser && matchingVoice(result.language)) speakBrowser(result, hint);
          else hint.textContent = copy.playbackBlocked;
        });
      }
    } catch {
      if (!isCurrent()) return;
      localSpeechRequest = null;
      if (fallbackToBrowser && matchingVoice(result.language)) speakBrowser(result, hint);
      else hint.textContent = copy.playbackUnavailable;
    }
  }

  function speak(result, hint = playbackHint) {
    speakBrowser(result, hint);
  }

  function toggleSpeechPlayback() {
    if (!currentResult || !playbackActive) return;
    const copy = messages[currentResult.language];
    if (playbackPaused) {
      if (activeAudio) {
        const playback = activeAudio.play();
        if (playback?.catch) playback.catch(() => {
          playbackHint.textContent = copy.playbackFailed;
        });
      } else if (activeUtterance) {
        window.speechSynthesis?.resume();
      }
      playbackPaused = false;
      playbackHint.textContent = copy.playbackPlaying;
    } else {
      if (activeAudio) activeAudio.pause();
      else if (activeUtterance) window.speechSynthesis?.pause();
      else return;
      playbackPaused = true;
      playbackHint.textContent = copy.playbackPaused;
    }
    updatePlaybackControl();
  }

  function speakBrowser(result, hint = playbackHint) {
    const isCurrent = () => isCurrentResult(result);
    if (!isCurrent()) return;
    cancelSpeech();
    const copy = messages[result.language];
    const voice = matchingVoice(result.language);
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      void speakLocally(result, hint, false);
      return;
    }
    if (!voice) {
      // Browser voices may load after the first getVoices() call (common on mobile).
      const localAttempt = speakLocally(result, hint, false);
      waitingForVoice = { result, hint };
      void localAttempt;
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
        playbackActive = true;
        playbackPaused = false;
        hint.textContent = copy.playbackPlaying;
        updatePlaybackControl();
      };
      utterance.onpause = () => {
        if (activeUtterance !== utterance || !isCurrent()) return;
        playbackPaused = true;
        hint.textContent = copy.playbackPaused;
        updatePlaybackControl();
      };
      utterance.onresume = () => {
        if (activeUtterance !== utterance || !isCurrent()) return;
        playbackPaused = false;
        hint.textContent = copy.playbackPlaying;
        updatePlaybackControl();
      };
      utterance.onerror = (event) => {
        if (activeUtterance !== utterance || !isCurrent()) return;
        clearPlaybackTimer();
        activeUtterance = null;
        playbackActive = false;
        playbackPaused = false;
        updatePlaybackControl();
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
        playbackActive = false;
        playbackPaused = false;
        hint.textContent = copy.playbackFinished;
        updatePlaybackControl();
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
    for (const element of [languageSelect, recordButton, voiceHint, symptomsField, transcriptLabel, submitButton, resultCard, speakResultButton, voiceAvailability, testVoiceButton, voiceSample, voiceTestHint, pauseSpeechButton]) {
      element.lang = language;
    }
    transcriptLabel.textContent = copy.transcriptLabel;
    symptomsField.placeholder = copy.transcriptPlaceholder;
    document.querySelector("#result-label").textContent = copy.statusLabel;
    speakResultButton.textContent = copy.hearMessage;
    updatePlaybackControl();
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
    clearGeneratedReport();
    if (localSignals.disease) {
      diagnosisAdvice.textContent = getLocalGuidance({ source: "disease", ...localSignals.disease, language }).text;
    }
    if (localSignals.pest) {
      pestDiagnosisAdvice.textContent = getLocalGuidance({ source: "pest", ...localSignals.pest, language }).text;
    }
    const copy = messages[language];
    const hint = symptomsField.value.trim() ? copy.languageChanged : copy.idle;
    applyLanguage(SpeechRecognition ? hint : `${hint} ${copy.unsupported}`);
  });

  photoInput.addEventListener("change", () => {
    analysisVersion += 1;
    const request = pendingRequest;
    pendingRequest = null;
    request?.controller.abort();
    updateControls();
    localSignals.disease = null;
    localSignals.pest = null;
    pestDiagnosis.hidden = true;
    if (photoUrl) window.URL.revokeObjectURL(photoUrl);
    photoUrl = null;
    photoCopy.querySelector("strong").textContent = "Drop a leaf photo here";
    photoPreview.hidden = true;
    analyzeButton.disabled = true;
    diagnosisCard.hidden = true;
    diagnosisTitle.textContent = "";
    diagnosisAlternatives.replaceChildren();
    diagnosisAdvice.textContent = "";
    clearGeneratedReport();
    clearResult();
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

  pestPhotoInput.addEventListener("change", () => {
    pestAnalysisVersion += 1;
    const request = pendingRequest;
    pendingRequest = null;
    request?.controller.abort();
    updateControls();
    localSignals.disease = null;
    localSignals.pest = null;
    diagnosisCard.hidden = true;
    pestDiagnosis.hidden = true;
    pestDiagnosisTitle.textContent = "";
    pestDiagnosisAdvice.textContent = "";
    clearResult();
    const file = pestPhotoInput.files?.[0];
    analyzePestButton.disabled = !file || !file.type.startsWith("image/");
    pestModelStatus.textContent = file && !file.type.startsWith("image/")
      ? "Choose a supported image of one cereal insect."
      : file
        ? `${file.name} is selected. The photo stays on this phone.`
        : "Pest results are a class guess, not insect counts or a treatment threshold.";
  });

  async function runDiseaseAnalysis() {
    const file = photoInput.files?.[0];
    if (!file) return false;

    const requestVersion = analysisVersion;
    const requestLanguage = language;
    analyzeButton.disabled = true;
    diagnosisCard.hidden = true;
    modelStatus.textContent = "Loading the on-device model and checking the photo…";
    try {
      classifyImage ??= createClassifier();
      const predictions = await classifyImage(file);
      if (requestVersion !== analysisVersion || requestLanguage !== language) return false;
      const [best, ...alternatives] = predictions;
      const readableName = (label) => label.replaceAll("___", " · ").replaceAll("_", " ").replace(/\s+/g, " ").trim();
      diagnosisTitle.textContent = `${readableName(best.label)} · ${Math.round(best.confidence * 100)}%`;
      diagnosisAlternatives.replaceChildren(...alternatives.map((prediction) => {
        const item = document.createElement("li");
        item.textContent = `${readableName(prediction.label)} · ${Math.round(prediction.confidence * 100)}%`;
        return item;
      }));
      const advice = getLocalGuidance({ source: "disease", label: best.label, confidence: best.confidence, language: requestLanguage });
      localSignals.disease = { label: best.label, confidence: best.confidence };
      diagnosisAdvice.textContent = advice.text;
      diagnosisCard.hidden = false;
      modelStatus.textContent = "Checked on this phone. The photo was not uploaded. Ask the voice assistant below for spoken guidance.";
      void loadDiagnosisReport({
        label: best.label,
        confidence: best.confidence,
        requestVersion,
        locale: requestLanguage,
      });
      return true;
    } catch (error) {
      if (requestVersion === analysisVersion && requestLanguage === language) {
        modelStatus.textContent = error instanceof Error
          ? error.message
          : "The offline model could not check this photo.";
      }
      return false;
    } finally {
      if (requestVersion === analysisVersion) analyzeButton.disabled = false;
    }
  }

  analyzeButton.addEventListener("click", () => {
    if (!analyzeButton.disabled) void runDiseaseAnalysis();
  });

  async function runPestAnalysis() {
    const file = pestPhotoInput.files?.[0];
    if (!file) return false;

    const requestVersion = pestAnalysisVersion;
    const requestLanguage = language;
    analyzePestButton.disabled = true;
    pestDiagnosis.hidden = true;
    pestModelStatus.textContent = "Loading the offline pest model and checking the photo…";
    try {
      classifyPest ??= createPest();
      const [best] = await classifyPest(file);
      if (requestVersion !== pestAnalysisVersion || requestLanguage !== language) return false;
      const advice = getLocalGuidance({ source: "pest", label: best.label, confidence: best.confidence, language: requestLanguage });
      localSignals.pest = { label: best.label, confidence: best.confidence };
      pestDiagnosisTitle.textContent = `${best.label.replaceAll("_", " ")} · ${Math.round(best.confidence * 100)}%`;
      pestDiagnosisAdvice.textContent = advice.text;
      pestDiagnosis.hidden = false;
      pestModelStatus.textContent = "Checked on this phone. The photo was not uploaded. Ask the voice assistant below for spoken guidance.";
      return true;
    } catch (error) {
      if (requestVersion === pestAnalysisVersion && requestLanguage === language) {
        pestModelStatus.textContent = error instanceof Error
          ? error.message
          : "The offline pest model could not check this photo.";
      }
      return false;
    } finally {
      if (requestVersion === pestAnalysisVersion) analyzePestButton.disabled = false;
    }
  }

  analyzePestButton.addEventListener("click", () => {
    if (!analyzePestButton.disabled) void runPestAnalysis();
  });

  submitButton.addEventListener("click", async () => {
    if (recognitionSession || pendingRequest) return;
    const requestLanguage = language;
    const copy = messages[requestLanguage];
    const symptoms = symptomsField.value.trim();
    if (!symptoms || (!photoInput.files?.length && !pestPhotoInput.files?.length)) {
      showResult(copy.empty, requestLanguage);
      return;
    }

    clearResult();
    const request = {
      language: requestLanguage,
      analysisVersion,
      pestAnalysisVersion,
      controller: new AbortController(),
    };
    pendingRequest = request;
    updateControls();
    const isCurrent = () => pendingRequest === request && language === request.language
      && analysisVersion === request.analysisVersion
      && pestAnalysisVersion === request.pestAnalysisVersion;
    try {
      if (!activeGuidance(requestLanguage) && autoAnalyzeOnSubmit) {
        const analyzed = photoInput.files?.length
          ? await runDiseaseAnalysis()
          : await runPestAnalysis();
        if (!isCurrent()) return;
        if (!analyzed) {
          showResult(copy.requestFailed, request.language);
          return;
        }
      }
      if (activeGuidance(requestLanguage)) {
        showSignalGuidance(requestLanguage);
        return;
      }

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

  speakResultButton.addEventListener("click", () => {
    if (currentResult) speak(currentResult, playbackHint);
  });
  pauseSpeechButton.addEventListener("click", toggleSpeechPlayback);
  testVoiceButton.addEventListener("click", async () => {
    if (recognitionSession || pendingRequest) return;
    updateVoiceAvailability();
    voiceTestResult = { text: messages[language].voiceSample, language };
    // Prefer the local OS voice for this manual check; use browser speech if unavailable.
    await speakLocally(voiceTestResult, voiceTestHint);
  });
  window.speechSynthesis?.addEventListener("voiceschanged", () => {
    updateVoiceAvailability();
    if (!waitingForVoice || !matchingVoice(waitingForVoice.result.language)) return;
    const waiting = waitingForVoice;
    if (activeAudio) {
      waitingForVoice = null;
      return;
    }
    speak(waiting.result, waiting.hint);
  });
  initSoilAssessment(document);
  applyLanguage();
  fetch("/api/health")
    .then((response) => response.ok ? response.json() : null)
    .then((payload) => {
      if (!Array.isArray(payload?.localTtsLanguages)) return;
      localTtsLanguages = new Set(payload.localTtsLanguages.filter(hasLanguage));
      updateVoiceAvailability();
    })
    .catch(() => {});
}

if (typeof window !== "undefined" && typeof document !== "undefined") initVoiceFlow();
