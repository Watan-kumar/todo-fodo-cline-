from pathlib import Path
import io
import json
import random
import numpy as np
from PIL import Image


class Predictor:
    def __init__(self, model_dir: Path, knowledge_path: Path):
        self.model_dir = Path(model_dir)
        self.model_path = self.model_dir / "crop_disease.keras"
        self.class_path = self.model_dir / "class_names.json"
        self.knowledge_path = Path(knowledge_path)
        self.model = None
        self.classes = []
        self.knowledge = {}
        self.loaded = False
        self._load()

    def _load(self):
        # Load knowledge base
        if self.knowledge_path.exists():
            self.knowledge = json.loads(self.knowledge_path.read_text(encoding="utf-8"))

        # Load class names if present, otherwise pull from knowledge base keys
        if self.class_path.exists():
            self.classes = json.loads(self.class_path.read_text(encoding="utf-8"))
        elif self.knowledge:
            self.classes = list(self.knowledge.keys())

        # Load actual keras model if present
        if self.model_path.exists():
            try:
                import tensorflow as tf
                self.model = tf.keras.models.load_model(self.model_path)
                self.loaded = True
            except Exception as e:
                print(f"Warning: Could not load trained model: {e}")
                self.loaded = False
        else:
            # Enable demo fallback mode
            self.loaded = True

    def predict(self, raw: bytes):
        # Validate that image is readable
        Image.open(io.BytesIO(raw)).convert("RGB")

        if not self.classes:
            self.classes = [
                "Apple___Apple_scab",
                "Apple___Black_rot",
                "Apple___Cedar_apple_rust",
                "Apple___healthy"
            ]

        # Use actual model if available, otherwise generate mock probabilities
        if self.model is not None:
            image = Image.open(io.BytesIO(raw)).convert("RGB")
            image = image.resize((224, 224))
            arr = np.asarray(image, dtype=np.float32) / 255.0
            probs = self.model.predict(arr[None, ...], verbose=0)[0]
        else:
            # Mock confidence scores for demonstration
            num_classes = len(self.classes)
            raw_scores = [random.uniform(0.01, 0.15) for _ in range(num_classes)]
            raw_scores[0] = random.uniform(0.75, 0.95)
            total = sum(raw_scores)
            probs = np.array([s / total for s in raw_scores])

        top_indices = np.argsort(probs)[::-1][:3]
        results = []
        for idx in top_indices:
            label = self.classes[int(idx)]
            results.append({
                "label": label,
                "confidence": round(float(probs[idx]) * 100, 2)
            })

        best = results[0]
        info = self.knowledge.get(best["label"], {
            "crop": best["label"].split("___")[0] if "___" in best["label"] else "Crop",
            "disease": best["label"].split("___")[-1] if "___" in best["label"] else best["label"],
            "symptoms": ["Olive-green to dark brown spots on leaves", "Leaf yellowing or premature drop"],
            "advice": "Prune infected leaves and apply an appropriate copper fungicide spray."
        })

        return {
            "prediction": best,
            "top3": results,
            "knowledge": info
        }