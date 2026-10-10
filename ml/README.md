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

## Architecture

- `train.py` builds a small 48×48 RGB CNN and saves its Keras model and ordered class names.
- `export_onnx.py` validates model dimensions and label count, then exports browser inference artifacts.
- `evaluate.py` prints classification metrics for its separate 224x224 model format.
- `split_dataset.py` is a legacy utility with a machine-specific absolute dataset path. Review and edit that path before running; it moves images from the training tree.
- `class_names.txt` is the tracked label list; training overwrites it based on the dataset's folder order.

The browser loader in `public/onnx-model.js` uses the ONNX file and JSON labels from `public/models/`. Current inference is local to the browser; no model or dataset is bundled here.

## License and Data

The repository has no root `LICENSE` file. Dataset, pretrained-model, and generated-weight rights are not granted by this folder or by a citation. Check the exact terms for each dataset/model version before training for redistribution or publishing generated weights. See [../docs/sources.md](../docs/sources.md) for references.
