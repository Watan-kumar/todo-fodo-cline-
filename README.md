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

## Offline Photo Checks

- The leaf classifier is a locally fine-tuned YOLOv8n classification model with 38 PlantVillage labels. The checkpoint is not bundled; generate it as described in [model-sources.md](docs/model-sources.md).
- The cereal-pest classifier is a MobileNetV3 model with 26 labels. Use it for one-insect close-ups; it does not return boxes or counts.
- Both classifiers run in the browser with ONNX Runtime Web. Leaf photos are not uploaded; the disease label, score, selected state, and optional notes are sent to the same local server for report generation.
- The main flow is photo → language → spoken or typed concern → spoken guidance. Submitting automatically checks an unclassified photo, then speaks the on-device class/score and localized safety guidance. The response can be paused and resumed; the spoken concern is retained as context but is not independently interpreted as a diagnosis.
- The optional report writer is a local Ollama instruct model configured with `OLLAMA_MODEL`. Verified pesticide records are retrieved separately from `data/pesticide-knowledge.json`, which is intentionally empty until exact crop/state recommendations and waiting intervals are checked against current official sources.
- Model scores are not severity measurements or confirmed diagnoses. The source-linked local IPM guide recommends conservative scouting and local confirmation; it does not prescribe pesticides or doses.

See [docs/model-sources.md](docs/model-sources.md) for licenses, model scope, preprocessing, and known validation limitations. Soil screening is based on entered lab/Soil Health Card values and field observations; it does not assess soil from a photo or prescribe fertilizer.

## Setup notes

The disease classifier is trained locally; its initial YOLOv8 checkpoint and training images are downloaded separately, and their terms need to fit your intended use. The optional report writer uses local Ollama. `qwen2:7b-instruct` is a 4.4 GB Apache-2.0 starting point with Hindi listed among its supported languages, but a local Hindi smoke test produced poor, unreliable prose. Leave `OLLAMA_MODEL` unset until report quality is reviewed by fluent speakers. If enabled, start Ollama, pull the model, and run `OLLAMA_MODEL=qwen2:7b-instruct npm start`. If `OLLAMA_URL` is set, it must remain on this machine's loopback address. The image and pesticide rows are not sent to Ollama, and there is no cloud LLM fallback.

The pesticide lookup is implemented but its data file is deliberately empty. Add a row only after verifying the exact disease/crop, state, product registration, dose, and pre-harvest interval against current official sources; follow [the JSON schema](data/pesticide-knowledge.schema.json). Until then the app must not name a product or dose.

## Architecture

- `server.js` serves the PWA and localized intake endpoints. `/api/intake` acknowledges text; it does not perform disease inference.
- `/api/diagnosis-report` validates the local classifier label, applies the provisional 70% report gate, retrieves exact state/disease rows, and can call local Ollama for symptom/cause/prevention text.
- `public/app.js`, `public/languages.js`, and `public/onnx-model.js` implement the voice/text flow, localized messages, and on-device image classification.
- `public/local-guidance.js` maps image signals to translated, conservative next steps.
- `public/dashboard.js`, `public/soil-assessment.js`, and `public/sw.js` provide dashboard interactions, rule-based soil screening, and offline asset caching.
- `public/models/` contains ordered labels, the separately licensed pest model, and its notices; generate the leaf ONNX model locally.
- `tools/train_yolov8_classifier.py` trains/evaluates/exports the leaf classifier; `tools/fetch_mobile_models.py` fetches the pest model; `ml/` contains a legacy CNN pipeline.
- `docs/` records research and model references; `test/` contains Node.js tests.

## Generate or refresh model assets

```sh
python3.11 -m venv .venv-yolo
.venv-yolo/bin/python -m pip install -r tools/plantvillage-dataset-requirements.txt -r tools/yolov8-requirements.txt
.venv-yolo/bin/python tools/prepare_plantvillage_dataset.py
.venv-yolo/bin/python tools/train_yolov8_classifier.py --data data/plantvillage-38
.venv-yolo/bin/python -m pip install -r tools/model-export-requirements.txt
.venv-yolo/bin/python tools/fetch_mobile_models.py
```

Dataset preparation downloads about 2 GB. Training defaults to 30 epochs and can take a long time on CPU; `--epochs 1` checks the training/export path. The generated leaf model and dataset are local and git-ignored. To enable reports, start Ollama in one terminal with `ollama serve`, pull `qwen2:7b-instruct` from another, then start the app with `OLLAMA_MODEL=qwen2:7b-instruct npm start`. See [model-sources.md](docs/model-sources.md) for dataset/model terms, validation, and known limits.

## License and Data

There is no root `LICENSE` file, so no project-wide reuse license is declared. Do not assume permission to reuse or redistribute the project code. The bundled model assets have separate upstream licenses, with notices in `public/models/licenses/`; training datasets and checkpoints are not included. Dataset references and attribution notes are in [docs/sources.md](docs/sources.md).
