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

The training pipeline uses **MobileNetV3Large** with ImageNet transfer learning. This is a practical choice for a student project because it provides a strong accuracy/size trade-off and can later be exported to TensorFlow Lite for edge/mobile deployment.

The project is organized so you can swap the backbone for EfficientNet, ConvNeXt, or another architecture without rewriting the website.

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

This project follows the standard TensorFlow/Keras transfer-learning pattern:
- Load an ImageNet-pretrained CNN.
- Freeze the backbone initially.
- Train a new classification head.
- Optionally unfreeze the upper backbone layers for fine-tuning.
- Use data augmentation and validation metrics.

Useful official documentation:
- https://www.tensorflow.org/tutorials/images/transfer_learning
- https://keras.io/api/applications/mobilenet/
- https://www.tensorflow.org/lite

## Dataset folder

For the simplest training workflow, arrange images like:

data/plantvillage/
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
python ml/train.py --data_dir ml/data/plantvillage --output_dir ml/models
```

For a quick smoke test:

```bash
python ml/train.py --data_dir ml/data/plantvillage --epochs 2 --output_dir ml/models
```

After training, you should have:

- ml/models/crop_disease.keras
- ml/models/class_names.json
- ml/models/metrics.json

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
| Transfer learning | `ml/train.py` |
| CNN feature extraction | `ml/train.py` |
| Image augmentation | `ml/train.py` |
| Softmax multi-class classification | model head in `ml/train.py` |
| Cross-entropy loss | `ml/train.py` |
| Adam optimizer | `ml/train.py` |
| Early stopping | `ml/train.py` |
| Reduce LR on plateau | `ml/train.py` |
| Precision/recall/F1 | `ml/evaluate.py` |
| REST API | `backend/main.py` |
| Image preprocessing | `backend/services/predictor.py` |
| Explainable symptom lookup | `backend/data/disease_knowledge.json` |
| Web frontend | `frontend/templates/index.html` |
| Styling | `frontend/static/style.css` |
| Browser interaction | `frontend/static/app.js` |

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
7. Export to TFLite for Android/edge deployment.
8. Add a weather-aware risk score as a separate model, not as hidden model input.
9. Keep all citations and dataset licenses in `docs/sources.md`.

## License note

Check the exact license of each dataset/version before redistribution. This repository does not redistribute PlantVillage or PlantDoc images.
