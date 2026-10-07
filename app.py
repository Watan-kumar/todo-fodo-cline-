import os
from pathlib import Path

# Limit CPU threads to prevent fan noise and overheating
os.environ["TF_NUM_INTRAOP_THREADS"] = "1"
os.environ["TF_NUM_INTEROP_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"

from flask import Flask, request, jsonify, render_template
import tensorflow as tf
import numpy as np
from PIL import Image

app = Flask(
    __name__,
    template_folder="frontend/templates",
    static_folder="frontend/static"
)

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "ml" / "crop_disease_model.keras"
LABELS_PATH = BASE_DIR / "ml" / "class_names.txt"

print("Loading trained model and class labels...")
model = tf.keras.models.load_model(str(MODEL_PATH))

with open(LABELS_PATH, "r") as f:
    class_names = [line.strip() for line in f.readlines()]

IMG_SIZE = (48, 48)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/predict", methods=["POST"])
def predict():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "error": "Empty filename"}), 400

    try:
        # Preprocess uploaded image
        image = Image.open(file.stream).convert("RGB")
        image = image.resize(IMG_SIZE)
        img_array = np.array(image, dtype=np.float32)
        img_array = np.expand_dims(img_array, axis=0)

        # Predict
        predictions = model.predict(img_array)
        top_idx = int(np.argmax(predictions[0]))
        confidence = float(predictions[0][top_idx]) * 100
        raw_label = class_names[top_idx]

        # Parse crop and disease name
        # Typical format: Crop___Disease or Crop_Disease
        if "___" in raw_label:
            crop_name, disease_name = raw_label.split("___", 1)
        elif "_" in raw_label:
            parts = raw_label.split("_", 1)
            crop_name, disease_name = parts[0], parts[1]
        else:
            crop_name, disease_name = "Crop", raw_label

        crop_clean = crop_name.replace("_", " ").strip()
        disease_clean = disease_name.replace("_", " ").strip()

        # Simple severity estimation based on confidence
        severity = "High" if confidence > 80 else ("Moderate" if confidence > 50 else "Low")

        return jsonify({
            "success": True,
            "crop": crop_clean,
            "disease": disease_clean,
            "confidence": f"{confidence:.1f}%",
            "severity": severity,
            "raw_class": raw_label
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=False, use_reloader=False, host="127.0.0.1", port=5000)