#!/usr/bin/env python3
"""Fetch permissively licensed checkpoints and export the leaf model to ONNX."""

import json
import sys
from pathlib import Path

import httpx
import onnx
import onnxruntime as ort
import torch
from transformers import AutoModelForImageClassification


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "public" / "models"
DISEASE_REPO = "Kathir56/plant-disease-tamilnadu"
DISEASE_REVISION = "d0d124b8d3ee91e3b00393a3566c77cd4bbe99ba"
PEST_REPO = "sheneman/CerealPestAID"
PEST_REVISION = "5b05341cabf70f3de7530438fca2290a09aba701"
PEST_LICENSE_URL = "https://raw.githubusercontent.com/sheneman/CerealPestAID/main/LICENSE"
APACHE_LICENSE_URL = "https://www.apache.org/licenses/LICENSE-2.0.txt"


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


def export_disease_model() -> None:
    model_path = MODEL_DIR / "plant-disease-tamilnadu.onnx"
    labels_path = MODEL_DIR / "plant-disease-tamilnadu-labels.json"
    if model_path.exists() and labels_path.exists():
        return

    model = AutoModelForImageClassification.from_pretrained(
        DISEASE_REPO,
        revision=DISEASE_REVISION,
        use_safetensors=True,
        trust_remote_code=False,
    ).eval()

    class Logits(torch.nn.Module):
        def __init__(self, classifier: torch.nn.Module) -> None:
            super().__init__()
            self.classifier = classifier

        def forward(self, pixel_values: torch.Tensor) -> torch.Tensor:
            return self.classifier(pixel_values=pixel_values, return_dict=False)[0]

    model_path.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        Logits(model),
        torch.zeros(1, 3, 224, 224),
        str(model_path),
        input_names=["pixel_values"],
        output_names=["logits"],
        dynamic_axes={"pixel_values": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
        dynamo=False,
    )
    onnx.checker.check_model(str(model_path))
    labels = [model.config.id2label[index] for index in range(model.config.num_labels)]
    labels_path.write_text(json.dumps(labels, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if len(labels) != 38:
        raise RuntimeError(f"Expected 38 disease classes, got {len(labels)}.")
    print(f"Exported {len(labels)} disease labels and {model_path.stat().st_size:,} model bytes.")


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
    download(APACHE_LICENSE_URL, license_dir / "Apache-2.0.txt")
    download(PEST_LICENSE_URL, license_dir / "MIT-CerealPestAID.txt")


def verify_disease_model() -> None:
    model_path = MODEL_DIR / "plant-disease-tamilnadu.onnx"
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    input_shape = session.get_inputs()[0].shape
    output_shape = session.get_outputs()[0].shape
    if input_shape[-2:] != [224, 224] or output_shape[-1] != 38:
        raise RuntimeError(f"Unexpected disease model contract: input={input_shape}, output={output_shape}.")
    print(f"Verified disease model contract: {input_shape} -> {output_shape}.")


def main() -> None:
    export_disease_model()
    verify_disease_model()
    fetch_pest_model()
    fetch_licenses()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Model preparation failed: {error}", file=sys.stderr)
        raise
