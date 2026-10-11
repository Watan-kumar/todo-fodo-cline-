#!/usr/bin/env python3
"""Download PlantVillage and prepare leak-resistant YOLO classification folders."""

import argparse
import json
import random
import tempfile
from collections import Counter
from pathlib import Path

from datasets import load_dataset
from huggingface_hub import hf_hub_download


ROOT = Path(__file__).resolve().parents[1]
LABELS_PATH = ROOT / "public" / "models" / "plantvillage-38-labels.json"
DATASET_ID = "mohanty/PlantVillage"
DATASET_SCRIPT = "plant_village.py"
DATASET_CONFIG = "default"
DATASET_REVISION = "ded437f547bfabb00b388b99043a237e3a21ce54"
DATASET_LICENSE = "CC-BY-SA-3.0 (Hugging Face card; loader notes uncertainty)"


def validation_leaf_ids(leaf_ids, fraction: float, seed: int) -> set[str]:
    """Choose whole leaf groups so near-duplicate views cannot cross splits."""
    if not 0 < fraction < 1:
        raise ValueError("Validation fraction must be greater than 0 and less than 1.")
    unique_ids = sorted({str(leaf_id) for leaf_id in leaf_ids if leaf_id is not None})
    if len(unique_ids) < 2:
        raise ValueError("The training split must contain at least two distinct leaf IDs.")
    random.Random(seed).shuffle(unique_ids)
    count = max(1, round(len(unique_ids) * fraction))
    count = min(count, len(unique_ids) - 1)
    return set(unique_ids[:count])


def export_dataset(dataset, output_dir: Path, labels: list[str], fraction: float, seed: int) -> dict:
    """Convert the upstream leaf-grouped train/test splits to YOLO folders."""
    if "train" not in dataset or "test" not in dataset:
        raise ValueError("The source dataset must provide train and test splits.")

    train_split = dataset["train"]
    test_split = dataset["test"]
    class_names = train_split.features["label"].names
    if class_names != labels or test_split.features["label"].names != labels:
        raise ValueError("The source dataset class order does not match the app's 38-label manifest.")
    if "leaf_id" not in train_split.column_names or "leaf_id" not in test_split.column_names:
        raise ValueError("The source dataset must include leaf_id values to prevent split leakage.")

    validation_ids = validation_leaf_ids(train_split["leaf_id"], fraction, seed)
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    if output_dir.exists():
        raise FileExistsError(f"Output already exists; move it aside before preparing data: {output_dir}")

    counts = {split: Counter() for split in ("train", "val", "test")}
    with tempfile.TemporaryDirectory(prefix="plantvillage-38-", dir=output_dir.parent) as temp_name:
        staging_dir = Path(temp_name)
        for source_name, source_split in (("train", train_split), ("test", test_split)):
            for index, row in enumerate(source_split):
                label = labels[row["label"]]
                split_name = (
                    "val"
                    if source_name == "train" and str(row["leaf_id"]) in validation_ids
                    else source_name
                )
                class_dir = staging_dir / split_name / label
                class_dir.mkdir(parents=True, exist_ok=True)
                row["image"].convert("RGB").save(
                    class_dir / f"{index:06d}.jpg",
                    format="JPEG",
                    quality=95,
                )
                counts[split_name][label] += 1

        for split_name in ("train", "val", "test"):
            missing = sorted(label for label in labels if counts[split_name][label] == 0)
            if missing:
                raise ValueError(f"Prepared {split_name} split has no images for: {', '.join(missing)}")

        manifest = {
            "source": DATASET_ID,
            "configuration": DATASET_CONFIG,
            "loaderRevision": DATASET_REVISION,
            "license": DATASET_LICENSE,
            "seed": seed,
            "validationFractionByLeafId": fraction,
            "counts": {
                split: {label: counts[split][label] for label in labels}
                for split in ("train", "val", "test")
            },
        }
        (staging_dir / "dataset-manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        staging_dir.rename(output_dir)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "data" / "plantvillage-38",
        help="Destination directory (must not already exist).",
    )
    parser.add_argument("--validation-fraction", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    labels = json.loads(LABELS_PATH.read_text(encoding="utf-8"))
    if len(labels) != 38 or labels != sorted(labels):
        raise ValueError(f"Expected the sorted 38-class label manifest at {LABELS_PATH}.")

    dataset_script = hf_hub_download(
        repo_id=DATASET_ID,
        filename=DATASET_SCRIPT,
        repo_type="dataset",
        revision=DATASET_REVISION,
    )
    dataset = load_dataset(
        dataset_script,
        DATASET_CONFIG,
        trust_remote_code=True,
    )
    manifest = export_dataset(dataset, args.output.resolve(), labels, args.validation_fraction, args.seed)
    totals = {split: sum(class_counts.values()) for split, class_counts in manifest["counts"].items()}
    print(f"Prepared PlantVillage at {args.output.resolve()}")
    print(f"Image counts: {totals}")
    print(f"Dataset license: {DATASET_LICENSE}")


if __name__ == "__main__":
    main()
