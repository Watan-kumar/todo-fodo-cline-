# KhetSuno

KhetSuno is a mobile-first crop-care web app prototype. It supports voice or typed intake in Hindi, Telugu, Tamil, Kannada, Malayalam, and Marathi; an installable dashboard; and a rule-based soil assessment. A crop-disease ONNX model can run locally in the browser when its model files are supplied.

> **Current limitation:** No trained disease model is included or connected in this checkout. Until a compatible ONNX model and label file are generated and installed, photo diagnosis is unavailable. The intake endpoint returns an explicit localized placeholder; it does not analyze symptoms or photos. Do not use this prototype as an agronomic diagnosis.

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

## Architecture

- `server.js` serves the static app and its ONNX Runtime Web assets. Its `/api/health` and `/api/intake` routes report service status and acknowledge localized intake; `/api/tts` can generate local macOS speech for supported system voices. None of these routes performs disease inference.
- `public/app.js`, `public/languages.js`, and `public/onnx-model.js` implement the voice/text flow, localized messages, and optional in-browser image classification.
- `public/dashboard.js` adds dashboard interactions; `public/soil-assessment.js` provides a rule-based soil questionnaire and broad crop suggestions.
- `public/sw.js` caches the app shell and optional model files for offline use after an initial visit.
- `ml/` contains experimental training, evaluation, and ONNX export scripts. Dataset and model artifacts are local and are not committed.
- `docs/` records research and data references; `test/` contains Node.js tests.
- `app.py` is a legacy Flask scaffold, not the app's startup path. It refers to model/template assets that are not included in this checkout.

See [KhetSuno-README.md](KhetSuno-README.md) for the voice workflow and optional model setup. Each source folder has a README with its responsibilities and commands.

## Optional Model Setup

The current training script expects image folders under:

```text
Clean_Dataset/Plant Diseases Dataset(Augmented)/train/<class-name>/
```

The dataset is not included. The experimental trainer takes only a small subset of batches for two epochs, so it is a smoke-test pipeline, not evidence of field accuracy. To install the Python dependencies and generate the optional model:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python ml/train.py
python ml/export_onnx.py
```

The exporter writes `public/models/crop_disease.onnx` and `public/models/class_names.json`. Keep generated model files local unless their training-data and model licenses permit redistribution. Review [ml/README.md](ml/README.md) before training; the evaluation script currently expects a separate 224x224 model/JSON-label layout.

## License and Data

There is no root `LICENSE` file in this repository, so no project-wide reuse license is declared. Do not assume permission to reuse or redistribute the project code; ask the project owner to choose and add a license. Third-party dependencies, datasets, pretrained weights, and assets are subject to their own terms. Dataset references and attribution notes are in [docs/sources.md](docs/sources.md); dataset images and model weights are not included here.
