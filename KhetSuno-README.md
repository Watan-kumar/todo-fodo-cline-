# KhetSuno mobile crop-care app

KhetSuno is a mobile-first installable web app with Hindi, Telugu, Tamil, Kannada, Malayalam, and Marathi voice/text intake. It includes separate, image-based ONNX classifiers for leaf disease and cereal pests, plus a source-linked local IPM guide. Once the app and model files have been cached, photo inference and the matching voice-assistant guidance work offline; photos are never sent to the server.

## Run

Requires Node.js 18 or newer.

```sh
npm install
npm start
```

Open http://localhost:4173 in a browser. For phone testing or installation, deploy over HTTPS. Service workers are restricted to secure contexts; localhost is also supported for development.

## Prepare the local classifier model

Install training dependencies and export the disease model from a legally usable PlantVillage copy laid out in matching `train/`, `val/`, and `test/` class folders. The dataset and trained checkpoint are not bundled:

```sh
python -m pip install -r tools/yolov8-requirements.txt
python tools/train_yolov8_classifier.py --data /path/to/plantvillage
python -m pip install -r tools/model-export-requirements.txt
python tools/fetch_mobile_models.py
```

This creates the disease and pest ONNX files, ordered labels, and upstream license notices under `public/models/`. Configure `OLLAMA_MODEL` to an installed local Ollama instruct model if you want generated explanatory reports; leave it unset to use conservative local screening guidance only. Treatment rows live in `data/pesticide-knowledge.json` and must be verified for exact crop/disease and state from current official sources before being added. See [model-sources.md](docs/model-sources.md) for scope, licenses, preprocessing, and limitations.

Use the leaf input only for leaf-disease screening and the separate insect input for a close-up cereal-pest photo. The first online visit lets the service worker cache both models and the ONNX runtime; later inference and IPM guidance run locally. Browser voice recognition and speech playback still depend on the phone's browser and installed language services.

## Language-consistent voice flow

- Choose Hindi, Telugu, Tamil, Kannada, Malayalam, or Marathi before speaking. Recognition uses that selected locale; it never automatically switches to another language.
- Recognized words appear in an editable text area. Review or correct them before requesting a response. Recognition does not submit automatically. Editing stops recognition so late speech results cannot overwrite corrections.
- A local photo signal produces a translated, conservative guide message in the voice assistant; the same message is spoken when a matching-language voice is available. With no photo signal, text intake only returns a reminder to run an on-device photo check; it does not diagnose symptoms.
- Playback requires an installed/browser-provided voice in the selected language (exact locale preferred, otherwise the same base language). An unrelated/default voice is never used. If voices load later, playback is retried only for the current response.
- If recognition is unavailable or fails, a localized message offers typing or retrying; language-specific recognition errors also offer explicitly selecting another language. Browsers do not reliably expose recognition language availability in advance, so failures are handled when reported by the service.
- If playback is unavailable or fails, the response remains readable and a localized message offers text, voice installation, or retrying with **Hear this message**. There is no automatic translation or language fallback.
- Changing language cancels recognition, pending requests, and speech, and clears old responses. Existing draft text is preserved with a notice to review or replace it for the newly selected language; it is not silently translated.

## Architecture and folder guides

The Node.js server delivers the PWA and localized intake endpoints. Voice interaction, soil assessment, and optional ONNX photo inference live in `public/`; Python model preparation scripts live in `ml/`. See the README files in `public/`, `ml/`, `docs/`, `scripts/`, and `test/` for folder-specific setup and responsibilities.

## License

This repository has no root `LICENSE` file, so it does not declare a project-wide reuse license. Do not assume permission to reuse or redistribute the code. Dataset, model, dependency, and asset licenses are separate; review their terms before use.

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

1. Validate or fine-tune both models on locally collected field images before using them for real crop decisions.
2. Expand crop-specific advice only from local agricultural extension guidance and keep pesticide thresholds/doses tied to crop, region, and current label directions.
3. Replace browser speech recognition and synthesis with an Indic ASR/TTS provider only if network-dependent voice services are acceptable.
