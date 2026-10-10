# KhetSuno voice prototype

Step 1 of the crop-health hackathon app: voice and photo intake in Hindi, Telugu, Tamil, Kannada, Malayalam, and Marathi.

## Run

Requires Node.js 18 or newer. No packages or API keys are needed for this prototype.

```sh
npm start
```

Open http://localhost:4173 in a browser. Microphone transcription still depends on browser support and the device's speech-recognition service. On macOS, spoken playback first uses installed system voices through `say` and `afconvert`, then falls back to browser speech. Hosted speech APIs and the disease classifier are not connected.

## Language-consistent voice flow

- Choose Hindi, Telugu, Tamil, Kannada, Malayalam, or Marathi before speaking. Recognition uses that selected locale; it never automatically switches to another language.
- Recognized words appear in an editable text area. Review or correct them, add a photo preview, and explicitly send the query. Recognition does not submit automatically. Editing stops recognition so late speech results cannot overwrite corrections.
- The intake endpoint returns the selected language alongside its localized placeholder. The displayed message and spoken message are the same text. The disease model is **not connected**, no crop analysis is performed, and photos remain local previews rather than uploads.
- Playback requires an installed/browser-provided voice in the selected language (exact locale preferred, otherwise the same base language). An unrelated/default voice is never used. If voices load later, playback is retried only for the current response.
- If recognition is unavailable or fails, a localized message offers typing or retrying; language-specific recognition errors also offer explicitly selecting another language. Browsers do not reliably expose recognition language availability in advance, so failures are handled when reported by the service.
- If playback is unavailable or fails, the response remains readable and a localized message offers text, voice installation, or retrying with **Hear this message**. There is no automatic translation or language fallback.
- Changing language cancels recognition, pending requests, and speech, and clears old responses. Existing draft text is preserved with a notice to review or replace it for the newly selected language; it is not silently translated.

## Manually checking audio

Choose your language, then press **▶ Test voice** below the language selector. This reads the sample without a microphone, crop photo, or crop-intake request. On macOS, local system voices are tried first for Hindi, Telugu, Tamil, and Kannada. Other languages and platforms use the browser voice when available. This only checks playback; it does not establish speech-recognition support.

Text is supported in all six languages; spoken output is **not guaranteed** in all six. The macOS fallback does not substitute Hindi for Marathi or another language. If no matching voice is installed or advertised by the browser, the response remains readable and the app explains playback is unavailable. A hosted TTS service is not connected.

If the browser blocks playback, press the playback button yourself and allow sound for the site. Playback status reports audio start/end events, not proof that sound reached your speakers: check tab mute, output volume, and the selected audio device if those events occur without audible sound. Engines that never start or report an error show retry/text guidance instead of staying silent indefinitely.

## Tests

```sh
npm test
```

Tests use Node's built-in test runner with no extra packages. They cover all six languages, editable transcription and explicit submission, matching response text/voice, unavailable speech, delayed voice loading, stale recognition/request callbacks, language changes, and the real HTTP intake contract. Web Speech and DOM adapters are mocked for deterministic flow tests; microphone permissions, recognition quality, installed voices, and audible playback still need checking on the target browser/device.

## Next integration steps

1. Connect a pretrained crop-disease classifier and show its supported labels and uncertainty.
2. Replace browser speech recognition and synthesis with the selected hosted Indic ASR/TTS provider after API access is confirmed.
3. Add a source-linked, language-specific advisory dataset for the initial supported crops.
