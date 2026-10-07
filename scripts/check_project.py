from pathlib import Path
required = [
    "README.md", "requirements.txt",
    "backend/main.py", "backend/services/predictor.py",
    "backend/data/disease_knowledge.json",
    "ml/train.py", "ml/evaluate.py",
    "frontend/templates/index.html",
    "frontend/static/app.js", "frontend/static/style.css",
    "docs/sources.md"
]
root = Path(__file__).resolve().parent.parent
missing = [p for p in required if not (root/p).exists()]
print("PROJECT OK" if not missing else "Missing:\n" + "\n".join(missing))
