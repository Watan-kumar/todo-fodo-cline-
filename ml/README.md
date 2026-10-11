# Model Development

This folder contains experimental scripts for preparing and exporting an image classifier. Training data and trained weights are not included in the repository.

## Quick Start

From the repository root, install the Python dependencies in an active virtual environment and prepare class-named image directories at:

```text
Clean_Dataset/Plant Diseases Dataset(Augmented)/train/<class-name>/
```

Then run:

```sh
python -m pip install -r requirements.txt
python ml/train.py
python ml/export_onnx.py
```

`train.py` writes `ml/crop_disease_model.keras` and refreshes `ml/class_names.txt`. The ONNX exporter converts those files to `public/models/crop_disease.onnx` and `public/models/class_names.json`. These are optional local artifacts; without both browser assets, photo inference cannot run.

Training is intentionally lightweight: it takes at most 20 training batches and 5 validation batches for 2 epochs. Treat it as a pipeline smoke test, not a model-quality or field-readiness result.

To evaluate a separately prepared 224x224 Keras model and JSON class-label file:

```sh
python ml/evaluate.py --data_dir /path/to/evaluation-images \
  --model /path/to/model.keras --classes /path/to/class_names.json
```

`evaluate.py` currently expects 224x224 inputs and JSON labels, unlike the 48x48 model and newline-separated labels produced by `train.py`. Do not use its defaults to evaluate the trainer's output without adapting the artifacts or script.

## Active disease classifier

The mobile app now expects a YOLOv8n **classification** checkpoint fine-tuned for the exact 38 ordered labels in `public/models/plantvillage-38-labels.json`. YOLOv8 supports classification as a separate image-level task; this path returns one class distribution, not leaf-lesion boxes.

The repository does not bundle a YOLOv8 PlantVillage checkpoint or dataset. The Hugging Face dataset card declares CC-BY-SA-3.0, though its loader script says that license is assumed and should be verified. The preparation script pins that loader revision, uses its default (color) configuration, preserves its published train/test split, and reserves whole leaf IDs from the training split for validation:

```sh
python3.11 -m venv .venv-yolo
.venv-yolo/bin/python -m pip install -r tools/plantvillage-dataset-requirements.txt -r tools/yolov8-requirements.txt
.venv-yolo/bin/python tools/prepare_plantvillage_dataset.py
.venv-yolo/bin/python tools/train_yolov8_classifier.py --data data/plantvillage-38
```

The preparation step downloads about 2 GB and writes a local image copy under the git-ignored `data/plantvillage-38/` directory. The generated manifest records the source, loader revision, license note, and per-class split counts. Confirm the dataset rights and satisfy any attribution/share-alike terms before redistributing data or model weights. The training step starts from pretrained `yolov8n-cls.pt`, evaluates on the published held-out `test/` split, and exports `public/models/plantvillage-yolov8n-cls.onnx` with its ordered label file. Training defaults to 30 epochs; `--epochs 1` is only a pipeline check. Ultralytics is AGPL-3.0 by default; review the exact software/checkpoint license before distributing or using it commercially.

## Legacy model pipeline

- `train.py` is an experimental, short-run 48×48 RGB CNN trainer, not the active disease model.
- `export_onnx.py` exports that legacy local Keras checkpoint.
- `evaluate.py` expects a separate 224x224 model format.
- `split_dataset.py` is a legacy utility with a machine-specific absolute dataset path. Review and edit that path before running; it moves images from the training tree.

Disease and pest photo inference runs locally in the browser; only the disease label, score, chosen state, and optional notes go to the local app endpoint when building an explanatory report.

## License and Data

The repository has no root `LICENSE` file. Dataset, pretrained-model, and generated-weight rights are not granted by this folder or by a citation. Check the exact terms for each dataset/model version before training for redistribution or publishing generated weights. See [../docs/sources.md](../docs/sources.md) for references.
