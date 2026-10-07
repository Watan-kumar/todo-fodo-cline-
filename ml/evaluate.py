import argparse, json
from pathlib import Path
import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data_dir", required=True)
    ap.add_argument("--model", default="ml/models/crop_disease.keras")
    ap.add_argument("--classes", default="ml/models/class_names.json")
    args = ap.parse_args()

    model = tf.keras.models.load_model(args.model)
    classes = json.loads(Path(args.classes).read_text(encoding="utf-8"))

    ds = tf.keras.utils.image_dataset_from_directory(
        args.data_dir, image_size=(224,224), batch_size=32, shuffle=False
    )

    y_true, y_pred = [], []
    for x, y in ds:
        p = model.predict(x, verbose=0)
        y_true.extend(y.numpy().tolist())
        y_pred.extend(np.argmax(p, axis=1).tolist())

    print(classification_report(y_true, y_pred, target_names=classes, zero_division=0))
    print("Confusion matrix:")
    print(confusion_matrix(y_true, y_pred))

if __name__ == "__main__":
    main()
