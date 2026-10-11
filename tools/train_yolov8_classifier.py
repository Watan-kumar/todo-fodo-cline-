#!/usr/bin/env python3
"""Fine-tune and export the PlantVillage 38-class YOLOv8 classifier."""

import argparse
import json
import shutil
from pathlib import Path

import numpy as np
import onnxruntime as ort
from ultralytics import YOLO


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "public" / "models"
LABELS_PATH = MODEL_DIR / "plantvillage-38-labels.json"
OUTPUT_MODEL = MODEL_DIR / "plantvillage-yolov8n-cls.onnx"
OUTPUT_LABELS = MODEL_DIR / "plantvillage-yolov8n-cls-labels.json"
IMAGE_SIZE = 224


def class_directories(split_dir: Path) -> list[str]:
    return sorted(path.name for path in split_dir.iterdir() if path.is_dir())


def validate_dataset(dataset_dir: Path, expected_labels: list[str]) -> None:
    for split in ("train", "val", "test"):
        split_dir = dataset_dir / split
        if not split_dir.is_dir():
            raise FileNotFoundError(f"Missing {split_dir}; expected train/val/test/class-name image folders.")
        labels = class_directories(split_dir)
        if labels != expected_labels:
            missing = sorted(set(expected_labels) - set(labels))
            unexpected = sorted(set(labels) - set(expected_labels))
            raise ValueError(f"{split} labels do not match the 38-class manifest; missing={missing}, unexpected={unexpected}.")
        if not any(path.is_file() for folder in split_dir.iterdir() if folder.is_dir() for path in folder.iterdir()):
            raise ValueError(f"No images found under {split_dir}.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True, help="Dataset root with train/, val/, and test/ class folders.")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--device", default="", help="Ultralytics device value, such as 0 or cpu.")
    parser.add_argument("--checkpoint", type=Path, help="Evaluate and export an existing trained checkpoint without retraining.")
    parser.add_argument("--project", type=Path, default=ROOT / "ml" / "runs")
    parser.add_argument("--name", default="plantvillage-yolov8n-cls")
    args = parser.parse_args()

    if args.epochs < 1 or args.batch < 1:
        parser.error("--epochs and --batch must be positive.")

    expected_labels = json.loads(LABELS_PATH.read_text(encoding="utf-8"))
    if len(expected_labels) != 38 or expected_labels != sorted(expected_labels):
        raise ValueError(f"Expected a sorted manifest of 38 classes at {LABELS_PATH}.")
    validate_dataset(args.data, expected_labels)

    if args.checkpoint:
        best_path = args.checkpoint.resolve()
    else:
        model = YOLO("yolov8n-cls.pt")
        model.train(
            data=str(args.data.resolve()),
            epochs=args.epochs,
            imgsz=IMAGE_SIZE,
            batch=args.batch,
            device=args.device or None,
            project=str(args.project.resolve()),
            name=args.name,
            patience=8,
            seed=42,
        )
        best_path = Path(model.trainer.save_dir) / "weights" / "best.pt"

    if not best_path.is_file():
        raise FileNotFoundError(f"Training did not create {best_path}.")

    trained = YOLO(str(best_path))
    trained_labels = [trained.names[index] for index in range(len(trained.names))]
    if trained_labels != expected_labels:
        raise ValueError("The trained classifier class order differs from the app's disease label manifest.")

    metrics = trained.val(data=str(args.data.resolve()), split="test", imgsz=IMAGE_SIZE)
    exported_path = Path(trained.export(format="onnx", imgsz=IMAGE_SIZE, dynamic=False, opset=18))
    session = ort.InferenceSession(str(exported_path), providers=["CPUExecutionProvider"])
    input_meta = session.get_inputs()[0]
    output_meta = session.get_outputs()[0]
    if input_meta.shape != [1, 3, IMAGE_SIZE, IMAGE_SIZE]:
        raise ValueError(f"Unexpected ONNX input shape: {input_meta.shape}.")
    if output_meta.shape != [1, len(expected_labels)]:
        raise ValueError(f"Unexpected ONNX output shape: {output_meta.shape}.")

    scores = session.run(
        [output_meta.name],
        {input_meta.name: np.zeros((1, 3, IMAGE_SIZE, IMAGE_SIZE), dtype=np.float32)},
    )[0]
    probabilities = np.asarray(scores[0], dtype=np.float32)
    if not np.isfinite(probabilities).all() or np.any(probabilities < 0) or np.any(probabilities > 1):
        raise ValueError("The exported YOLO classifier did not return finite class probabilities.")
    if not np.isclose(float(probabilities.sum()), 1.0, atol=0.02):
        raise ValueError("The exported YOLO classifier output does not sum to one.")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(exported_path, OUTPUT_MODEL)
    OUTPUT_LABELS.write_text(json.dumps(expected_labels, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(expected_labels)} class probabilities to {OUTPUT_MODEL}")
    print(f"Test top-1 accuracy: {metrics.top1:.4f}")


if __name__ == "__main__":
    main()
