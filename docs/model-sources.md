# On-device Model Sources

The web app packages two independently trained image classifiers. Both run in the browser with ONNX Runtime Web; selected images are not uploaded.

## Leaf disease classifier

- Upstream: [Kathir56/plant-disease-tamilnadu](https://huggingface.co/Kathir56/plant-disease-tamilnadu)
- License declared by the model card: Apache-2.0.
- Architecture and scope: MobileNetV2, 38 PlantVillage classes covering healthy leaves and named disease classes across 14 crops. One class is two-spotted spider mite on tomato.
- Output: a class-score vector; the app applies softmax and shows the top three labels.
- Image preprocessing: RGB; resize the shortest edge to 256 px, center crop 224 × 224, scale to [0, 1], then normalize each channel with mean 0.5 and standard deviation 0.5.
- The model card reports 97.31% on PlantVillage. This self-reported dataset score is not evidence of the same accuracy on field photos.

## Cereal pest classifier

- Upstream: [sheneman/CerealPestAID](https://huggingface.co/sheneman/CerealPestAID), [source code](https://github.com/sheneman/CerealPestAID), and its [ONNX conversion guide](https://github.com/sheneman/CerealPestAID/blob/main/conversion/CONVERSION_GUIDE.md).
- License declared by the project and model card: MIT.
- Architecture and scope: MobileNetV3-Large, 26 cereal-pest-related categories, including predator and non-pest-herbivore classes.
- Output: one image-level class-score vector; the app applies softmax and shows the top label. It does not return bounding boxes or count insects.
- Bundled ONNX contract: the upstream conversion guide and ONNX graph specify 224 × 224 input. The app resizes RGB images to 224 × 224, scales to [0, 1], then normalizes with ImageNet mean and standard deviation.
- The model card reports 90.09% test accuracy for MobileNetV3-Large on its held-out image split using 528 × 528 input. That score does not apply to the bundled 224 × 224 ONNX export and is not evidence of performance on local field photos.

## Offline guide

`public/local-guidance.js` maps model labels to translated, conservative screening steps. It follows general Integrated Pest Management guidance: monitor multiple plants, distinguish beneficial insects, confirm uncertain symptoms with a local agriculture worker, and avoid acting on a model score alone. It does not prescribe pesticide products, doses, or application schedules. The evidence links are in [sources.md](sources.md).

## Rebuilding the browser models

The disease checkpoint is exported from pinned public safetensors weights; the cereal pest ONNX artifact and labels are fetched from a pinned public model revision. The script checks each ONNX graph and expected input/output dimensions. The upstream MobileNetV3 ONNX conversion guide specifies 224 × 224 input, while its reported evaluation uses 528 × 528; do not interpret that accuracy figure as validation of the bundled export.

```sh
python -m pip install -r tools/model-export-requirements.txt
python tools/fetch_mobile_models.py
```
