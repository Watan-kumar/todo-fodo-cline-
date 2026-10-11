# On-device Model Sources

The web app has a YOLOv8n image classifier for leaf disease and a separate pest classifier. Both run in the browser with ONNX Runtime Web; selected images are not uploaded. The PlantVillage dataset and YOLOv8 checkpoint are downloaded/generated locally and ignored by git. The ONNX classifier is required for leaf-disease inference.

## Leaf disease classifier

- Initialization: Ultralytics `yolov8n-cls.pt`, fine-tuned locally on the PlantVillage directory structure. The dataset preparation script pins the reviewed loader revision of `mohanty/PlantVillage`, uses its default (color) configuration, and keeps the published test split isolated; validation is carved from training by whole `leaf_id` groups. The dataset card declares CC-BY-SA-3.0, while the loader script says that license is assumed and should be verified. The ordered 38-class manifest is `public/models/plantvillage-38-labels.json`.
- Scope: 38 PlantVillage labels across 14 crops, including healthy leaves and named disease classes. One class is two-spotted spider mite on tomato.
- Output: the exported YOLOv8 classification graph returns class probabilities; the app validates the probability distribution and shows its top three labels.
- Image preprocessing: RGB; resize shortest edge to 224 px, center crop 224 × 224, scale to [0, 1]. This follows Ultralytics YOLOv8 8.3.0 classification inference transforms.
- The current local one-epoch prototype scored 94.1% top-1 and 99.9% top-5 on the published 10,709-image test split. These controlled PlantVillage images do not establish field accuracy, and the 70% confidence gate has not been calibrated on local field photos.

The previous app path used `plant-disease-tamilnadu.onnx`, also with 38 labels, but this repository does not identify its architecture, training data, or validation results. The YOLOv8 classifier now supplies disease predictions.

## Cereal pest classifier

- Upstream: [sheneman/CerealPestAID](https://huggingface.co/sheneman/CerealPestAID), [source code](https://github.com/sheneman/CerealPestAID), and its [ONNX conversion guide](https://github.com/sheneman/CerealPestAID/blob/main/conversion/CONVERSION_GUIDE.md).
- License declared by the project and model card: MIT.
- Architecture and scope: MobileNetV3-Large, 26 cereal-pest-related categories, including predator and non-pest-herbivore classes.
- Output: one image-level class-score vector; the app applies softmax and shows the top label. It does not return bounding boxes or count insects.
- Bundled ONNX contract: the upstream conversion guide and ONNX graph specify 224 × 224 input. The app resizes RGB images to 224 × 224, scales to [0, 1], then normalizes with ImageNet mean and standard deviation.
- The model card reports 90.09% test accuracy for MobileNetV3-Large on its held-out image split using 528 × 528 input. That score does not apply to the bundled 224 × 224 ONNX export and is not evidence of performance on local field photos.

## Offline guide

`public/local-guidance.js` maps model labels to translated, conservative screening steps. It follows general Integrated Pest Management guidance: monitor multiple plants, distinguish beneficial insects, confirm uncertain symptoms with a local agriculture worker, and avoid acting on a model score alone. It does not prescribe pesticide products, doses, or application schedules. The evidence links are in [sources.md](sources.md).

## Generating the browser models

Prepare and train the leaf model, then fetch the pinned cereal pest model:

```sh
python3.11 -m venv .venv-yolo
.venv-yolo/bin/python -m pip install -r tools/plantvillage-dataset-requirements.txt -r tools/yolov8-requirements.txt -r tools/model-export-requirements.txt
.venv-yolo/bin/python tools/prepare_plantvillage_dataset.py
.venv-yolo/bin/python tools/train_yolov8_classifier.py --data data/plantvillage-38
.venv-yolo/bin/python tools/fetch_mobile_models.py
```

The dataset card declares CC-BY-SA-3.0, while its loader script says that license is assumed and should be verified. Ultralytics code and pretrained assets have AGPL-3.0/Enterprise licensing paths. Verify the exact terms before redistributing data or generated weights, or using the workflow commercially. The generated disease ONNX artifact is ignored by git. See [sources.md](sources.md) for links and [../data/pesticide-knowledge.schema.json](../data/pesticide-knowledge.schema.json) for the verified-treatment row fields. `data/pesticide-knowledge.json` is deliberately empty until pesticide, dose, and pre-harvest information is verified for a specific crop and state from current official material.

When `OLLAMA_MODEL` is set, run a local Ollama server on the same machine (or set `OLLAMA_URL` to another private/local Ollama endpoint). `qwen2:7b-instruct` is one option; its Ollama listing shows Apache-2.0 licensing and lists Hindi among supported languages. In local testing on an Apple M5, it took roughly 9–15 seconds per request and produced poor, unreliable Hindi prose. Do not use its generated text with farmers until fluent speakers review it; leaving `OLLAMA_MODEL` unset uses the app's localized conservative guidance instead. Only the label, score, state, and optional note are sent; image bytes and pesticide rows are not sent to the language model. The API uses the language model for symptoms, possible cause, and prevention text only. The parser rejects incomplete reports, text outside the requested language script, and known pesticide/treatment terms. These checks cannot detect every inaccurate or awkward statement. The model does not make pesticide decisions.
