from pathlib import Path


REQUIRED_FILES = [
    "README.md",
    "KhetSuno-README.md",
    "package.json",
    "server.js",
    "public/README.md",
    "public/icons/README.md",
    "public/index.html",
    "public/app.js",
    "public/onnx-model.js",
    "public/states.js",
    "public/soil-assessment.js",
    "ml/README.md",
    "ml/train.py",
    "ml/evaluate.py",
    "ml/export_onnx.py",
    "docs/README.md",
    "docs/sources.md",
    "pesticide-rag.js",
    "data/pesticide-knowledge.json",
    "data/pesticide-knowledge.schema.json",
    "tools/train_yolov8_classifier.py",
    "scripts/README.md",
    "test/README.md",
]


def main():
    root = Path(__file__).resolve().parent.parent
    missing = [path for path in REQUIRED_FILES if not (root / path).is_file()]
    if missing:
        print("Missing required project files:\n" + "\n".join(missing))
        return 1

    print("PROJECT OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
