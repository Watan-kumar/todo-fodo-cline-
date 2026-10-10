# Crop Disease AI — Explainable Image-Based Detection

A clean, modular college-project implementation for **image-based crop disease classification**.

## What this project does

1. Accepts a crop/leaf image from a web page.
2. Sends it to a FastAPI backend.
3. Preprocesses the image to the same input size used by the trained model.
4. Runs a TensorFlow/Keras image classifier.
5. Returns the predicted class, confidence, top-3 alternatives, and a symptom/knowledge record.
6. Displays the result in a simple frontend.

> **Important:** This is a decision-support prototype, not a replacement for an agricultural expert or laboratory diagnosis. A model can be wrong, especially on field images that differ from its training data.

## Model choice

The current training script uses a small 48×48 convolutional classifier. The KhetSuno web app can run its exported ONNX model locally in the phone browser through ONNX Runtime Web. The app does not upload leaf photos for inference.

## Dataset references

### PlantVillage
PlantVillage contains 54,306 images covering 14 crop species and 26 diseases; when healthy classes are included, the standard taxonomy has 38 class labels.

- Repository: https://github.com/spMohanty/PlantVillage-Dataset
- Dataset card: https://huggingface.co/datasets/mohanty/PlantVillage
- Original paper: Mohanty et al., 2016, Frontiers in Plant Science.

### PlantDoc
PlantDoc provides real-world plant disease images and is useful as a second dataset for testing/generalization. The published dataset contains 2,598 images across 13 plant species and up to 17 disease classes.

- Repository: https://github.com/pratikkayal/PlantDoc-Dataset
- Object-detection version: https://github.com/pratikkayal/PlantDoc-Object-Detection-Dataset

## Google / TensorFlow references

The current training script is a compact custom CNN, not a transfer-learning implementation. TensorFlow/Keras trains the classifier; `ml/export_onnx.py` converts the saved model for browser-side inference.

Useful official documentation:
- https://www.tensorflow.org/guide/keras/serialization_and_saving
- https://www.tensorflow.org/lite

## Dataset folder

The current `ml/train.py` script reads images from:

Clean_Dataset/Plant Diseases Dataset(Augmented)/train/
    Apple___Apple_scab/
        image1.jpg
        image2.jpg
    Apple___healthy/
        image3.jpg
    ...
    Tomato___Tomato_mosaic_virus/
        image4.jpg

The folder names become the model's class labels.

## Install

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Linux/macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Train

```bash
python ml/train.py
```

After training, the script writes:

- `ml/crop_disease_model.keras`
- `ml/class_names.txt`

## Run the website

```bash
uvicorn backend.main:app --reload
```

Open:

http://127.0.0.1:8000

## API

POST `/api/predict`

Form field:
- `file`: image file

GET `/api/health`

GET `/api/classes`

## Architecture

frontend/
    Browser UI

backend/
    FastAPI API
    image validation
    model inference
    knowledge lookup

ml/
    training pipeline
    model export
    evaluation

data/
    local datasets (not committed)

## How the theory maps to the code

| Theory | File |
|---|---|
| CNN image classification | `ml/train.py` |
| Softmax multi-class classification | model head in `ml/train.py` |
| Cross-entropy loss and Adam | `ml/train.py` |
| REST API | `backend/main.py` |
| Image preprocessing | `backend/services/predictor.py` |
| Explainable symptom lookup | `backend/data/disease_knowledge.json` |
| Web frontend | `frontend/templates/index.html` |
| Styling | `frontend/static/style.css` |
| On-device browser inference | `public/onnx-model.js` |

## About the 700–800 symptom target

Do not invent 700–800 disease diagnoses. The model's actual disease classes must come from labeled training data.

This starter instead uses a **knowledge layer** separate from the classifier. It can be expanded to hundreds of symptom observations while keeping the model taxonomy scientifically traceable. The initial knowledge file covers the PlantVillage classes and is deliberately conservative.

For a high-scoring SIH-style version, expand the knowledge base from authoritative agricultural extension sources and record a URL/source for every disease entry. Do not treat web text as training data unless its licensing permits it.

## Suggested next-level improvements

1. Train on PlantVillage.
2. Evaluate separately on PlantDoc to measure domain shift.
3. Add Grad-CAM heatmaps to show which leaf regions influenced the prediction.
4. Add an "unknown / low confidence" threshold.
5. Add crop selection as an optional input to reduce impossible classes.
6. Add field-image augmentation and locally collected images.
7. Export to ONNX for on-device browser/phone deployment.
8. Add a weather-aware risk score as a separate model, not as hidden model input.
9. Keep all citations and dataset licenses in `docs/sources.md`.

## License note

Check the exact license of each dataset/version before redistribution. This repository does not redistribute PlantVillage or PlantDoc images.

## KhetSuno mobile app

The repository root also includes KhetSuno, a mobile-first installable web app. It caches its app shell and ONNX runtime for offline use. Once an ONNX model is exported and cached, leaf classification runs on the phone without a server request.

Install the Node dependency and start the app:

```sh
npm install
npm start
```

To make the on-device classifier available, first train the project model, then export it:

```sh
python ml/train.py
python ml/export_onnx.py
```

The exporter writes `public/models/crop_disease.onnx` and the matching labels file. These artifacts are not included because this checkout has no trained model or dataset. Deploy over HTTPS (or use localhost during development), open the app once while online so it can cache the runtime and model, then install it from the phone browser.

See [KhetSuno-README.md](KhetSuno-README.md) for mobile setup, offline behavior, voice support, and limitations.
