#!/usr/bin/env python3
"""Fetch the separately licensed cereal-pest checkpoint and its labels."""

import json
import sys
from pathlib import Path

import httpx
import onnx
import onnxruntime as ort


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "public" / "models"
PEST_REPO = "sheneman/CerealPestAID"
PEST_REVISION = "5b05341cabf70f3de7530438fca2290a09aba701"
PEST_LICENSE_URL = "https://raw.githubusercontent.com/sheneman/CerealPestAID/main/LICENSE"


def download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return

    print(f"Downloading {path.name}...")
    temporary_path = path.with_name(f"{path.name}.download")
    try:
        with httpx.stream("GET", url, follow_redirects=True, timeout=120) as response:
            response.raise_for_status()
            with temporary_path.open("wb") as output:
                for chunk in response.iter_bytes():
                    output.write(chunk)
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def fetch_pest_model() -> None:
    model_path = MODEL_DIR / "cerealpestaid-mobilenetv3.onnx"
    labels_path = MODEL_DIR / "cerealpestaid-labels.json"
    model_url = (
        f"https://huggingface.co/{PEST_REPO}/resolve/{PEST_REVISION}/"
        "mobilenetv3/mobilenetv3_simplified.onnx"
    )
    labels_url = f"https://huggingface.co/{PEST_REPO}/resolve/{PEST_REVISION}/label_mappings.txt"
    download(model_url, model_path)
    if not labels_path.exists():
        temporary_labels = MODEL_DIR / "label_mappings.txt"
        download(labels_url, temporary_labels)
        labels: list[str | None] = [None] * 26
        for row in temporary_labels.read_text(encoding="utf-8").splitlines():
            index, label = row.split(maxsplit=1)
            labels[int(index)] = label.strip()
        if any(label is None for label in labels):
            raise RuntimeError("The pest label map is incomplete.")
        labels_path.write_text(json.dumps(labels, indent=2) + "\n", encoding="utf-8")
        temporary_labels.unlink()
    model = onnx.load(model_path)
    onnx.checker.check_model(model)
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    input_shape = session.get_inputs()[0].shape
    output_shape = session.get_outputs()[0].shape
    if input_shape[-2:] != [224, 224] or output_shape[-1] != 26:
        raise RuntimeError(f"Unexpected pest model contract: input={input_shape}, output={output_shape}.")
    print(f"Fetched pest model ({model_path.stat().st_size:,} bytes; {input_shape} -> {output_shape}).")


def fetch_licenses() -> None:
    license_dir = MODEL_DIR / "licenses"
    download(PEST_LICENSE_URL, license_dir / "MIT-CerealPestAID.txt")


def main() -> None:
    fetch_pest_model()
    fetch_licenses()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Model preparation failed: {error}", file=sys.stderr)
        raise
