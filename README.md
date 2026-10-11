# KhetSuno

KhetSuno is a mobile-first crop-care web app with voice or typed intake in Hindi, Telugu, Tamil, Kannada, Malayalam, and Marathi; an installable dashboard; and a rule-based soil assessment. It includes separate ONNX image classifiers for leaf disease and cereal pests, with translated local guidance spoken through the voice assistant when a matching device voice is available.

> **Limitations:** Photo models provide screening signals, not field-validated diagnoses. They do not count pests or measure disease severity, and their performance may differ on local field photos. Text intake only acknowledges the message; it does not diagnose symptoms or analyze photos. Confirm crop decisions with a local agricultural expert.

## Quick Start

Requires Node.js 18 or newer.

```sh
npm install
npm start
```

Open <http://localhost:4173>. Run the test suite with:

```sh
npm test
```

For phone installation and service-worker support, serve the app over HTTPS. Localhost is supported for development. Browser speech recognition and speech playback depend on browser and device language support.

## Optional Cline Soil Explanation

The soil screening remains deterministic and runs in the browser without a model. After an offline assessment, **Explain with Cline (online)** can send only the soil readings, the computed screening result, and the selected language to `POST /api/soil-explain`. The server recomputes and verifies the result before asking Cline CLI for a plain-language explanation. No crop photos, voice transcript, or symptom text are sent by this feature.

Install and configure Cline CLI on the server machine before using the optional explanation:

```sh
npm install -g cline
"$(npm root -g)/cline/bin/cline" auth
CLINE_CLI_PATH="$(npm root -g)/cline/bin/cline" npm start
```

If Cline CLI is installed elsewhere, set `CLINE_CLI_PATH` to its executable before starting the app. The CLI uses the configured Cline model/provider, which may send the request to an external AI service. If CLI setup, authentication, or the model is unavailable, the offline screening remains usable.

## Offline Photo Checks

- The leaf classifier is a MobileNetV2 model with 38 PlantVillage labels.
- The cereal-pest classifier is a MobileNetV3 model with 26 labels. Use it for one-insect close-ups; it does not return boxes or counts.
- Both models run in the browser with ONNX Runtime Web. Photos are not uploaded. Open the app online once so the service worker can cache its runtime and model files for later offline use.
- Model scores are not severity measurements or confirmed diagnoses. The source-linked local IPM guide recommends conservative scouting and local confirmation; it does not prescribe pesticides or doses.

See [docs/model-sources.md](docs/model-sources.md) for licenses, model scope, preprocessing, and known validation limitations. Soil screening is based on entered lab/Soil Health Card values and field observations; it does not assess soil from a photo or prescribe fertilizer.

## Architecture

- `server.js` serves the PWA and localized endpoints. `/api/intake` acknowledges text without disease inference; `/api/soil-explain` validates deterministic soil results and optionally asks the configured Cline CLI to explain them.
- `public/app.js`, `public/languages.js`, and `public/onnx-model.js` implement the voice/text flow, localized messages, and on-device image classification.
- `public/local-guidance.js` maps image signals to translated, conservative next steps.
- `public/dashboard.js`, `public/soil-assessment.js`, and `public/sw.js` provide dashboard interactions, rule-based soil screening, and offline asset caching.
- `public/models/` contains the bundled ONNX weights, ordered labels, and model license notices.
- `tools/fetch_mobile_models.py` rebuilds/fetches the public model assets; `ml/` contains separate experimental training and evaluation scripts.
- `docs/` records research and model references; `test/` contains Node.js tests.

## Refresh the Bundled Models

```sh
python -m pip install -r tools/model-export-requirements.txt
python tools/fetch_mobile_models.py
```

This exports the pinned leaf-disease checkpoint and fetches the pinned cereal-pest ONNX model, labels, and license notices.

## License and Data

There is no root `LICENSE` file, so no project-wide reuse license is declared. Do not assume permission to reuse or redistribute the project code. The bundled model assets have separate upstream licenses, with notices in `public/models/licenses/`; training datasets and checkpoints are not included. Dataset references and attribution notes are in [docs/sources.md](docs/sources.md).
