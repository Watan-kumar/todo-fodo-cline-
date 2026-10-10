import json
import sys
from pathlib import Path

import tensorflow as tf
import tf2onnx


ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT / "ml" / "crop_disease_model.keras"
CLASS_NAMES_PATH = ROOT / "ml" / "class_names.txt"
OUTPUT_DIR = ROOT / "public" / "models"
IMAGE_SIZE = 48


def main():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Trained Keras model not found: {MODEL_PATH}")
    if not CLASS_NAMES_PATH.exists():
        raise FileNotFoundError(f"Class label list not found: {CLASS_NAMES_PATH}")

    class_names = [
        name.strip()
        for name in CLASS_NAMES_PATH.read_text(encoding="utf-8").splitlines()
        if name.strip()
    ]
    model = tf.keras.models.load_model(MODEL_PATH)
    if tuple(model.input_shape[1:]) != (IMAGE_SIZE, IMAGE_SIZE, 3):
        raise ValueError(
            f"Expected model input shape (None, {IMAGE_SIZE}, {IMAGE_SIZE}, 3), "
            f"got {model.input_shape}"
        )
    if int(model.output_shape[-1]) != len(class_names):
        raise ValueError(
            f"Model has {model.output_shape[-1]} outputs but {len(class_names)} labels."
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    model_path = OUTPUT_DIR / "crop_disease.onnx"
    signature = [tf.TensorSpec([None, IMAGE_SIZE, IMAGE_SIZE, 3], tf.float32, name="leaf")]
    tf2onnx.convert.from_keras(
        model,
        input_signature=signature,
        opset=13,
        output_path=str(model_path),
    )
    (OUTPUT_DIR / "class_names.json").write_text(
        json.dumps(class_names, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"ONNX model written to {model_path}")
    print(f"Exported {len(class_names)} class labels.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Model export failed: {error}", file=sys.stderr)
        raise
