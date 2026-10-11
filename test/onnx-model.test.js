import assert from "node:assert/strict";
import test from "node:test";
import {
  classifierScoresToProbabilities,
  createOfflineClassifier,
  createPestClassifier,
  logitsToProbabilities,
  topPredictions,
} from "../public/onnx-model.js";

test("logits become stable probabilities", () => {
  const probabilities = logitsToProbabilities([1000, 1001]);
  assert.ok(Math.abs(probabilities[0] - 0.2689414) < 1e-6);
  assert.ok(Math.abs(probabilities[1] - 0.7310586) < 1e-6);
  assert.throws(() => logitsToProbabilities([Number.NaN]), /invalid prediction scores/i);
});

test("top predictions pair sorted scores with their matching labels", () => {
  assert.deepEqual(topPredictions([0.1, 0.8, 0.4], ["a", "b", "c"]), [
    { label: "b", confidence: 0.8 },
    { label: "c", confidence: 0.4 },
    { label: "a", confidence: 0.1 },
  ]);
  assert.throws(() => topPredictions([0.2], ["a", "b"]), /does not match/i);
});

test("YOLO classification probabilities are used directly and invalid distributions fail closed", () => {
  assert.deepEqual(classifierScoresToProbabilities([0.25, 0.75], "probabilities"), [0.25, 0.75]);
  assert.throws(() => classifierScoresToProbabilities([0.25, 0.5], "probabilities"), /invalid class probabilities/i);
  assert.throws(() => classifierScoresToProbabilities([1.1, -0.1], "probabilities"), /invalid class probabilities/i);
  assert.deepEqual(classifierScoresToProbabilities([0, 1]), logitsToProbabilities([0, 1]));
});

for (const [name, createClassifier, modelPath, labelsPath, imageSize] of [
  ["leaf disease", createOfflineClassifier, "/models/plantvillage-yolov8n-cls.onnx", "/models/plantvillage-yolov8n-cls-labels.json", 224],
  ["cereal pest", createPestClassifier, "/models/cerealpestaid-mobilenetv3.onnx", "/models/cerealpestaid-labels.json", 224],
]) {
  test(`${name} classifier loads its local ONNX model once and runs on-device`, async () => {
    let sessionCreations = 0;
    let runCount = 0;
    let receivedTensor;
    class Tensor {
      constructor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      }
    }
    const runtime = {
      env: { wasm: {} },
      Tensor,
      InferenceSession: {
        async create(path, options) {
          sessionCreations += 1;
          assert.equal(path, modelPath);
          assert.deepEqual(options, { executionProviders: ["wasm"] });
          return {
            inputNames: ["pixel_values"],
            outputNames: ["logits"],
            async run(inputs) {
              runCount += 1;
              receivedTensor = inputs.pixel_values;
              return { logits: { data: Float32Array.from(name === "leaf disease" ? [0.2, 0.8] : [0, 1]) } };
            },
          };
        },
      },
    };
    let labelFetches = 0;
    const fetchImpl = async (path) => {
      labelFetches += 1;
      assert.equal(path, labelsPath);
      return { ok: true, json: async () => ["healthy", "rust"] };
    };
    let canvas;
    let drawArguments;
    const documentRef = {
      createElement() {
        canvas = {
          width: 0,
          height: 0,
          getContext() {
            return {
              drawImage(...arguments_) {
                drawArguments = arguments_;
              },
              getImageData() {
                const rgba = new Uint8ClampedArray(imageSize * imageSize * 4);
                rgba.set([12, 34, 56, 255]);
                return { data: rgba };
              },
            };
          },
        };
        return canvas;
      },
    };
    const classifier = createClassifier({
      runtime,
      fetchImpl,
      documentRef,
      bitmapFactory: async () => ({ width: 600, height: 400, close() {} }),
    });

    const predictions = await classifier({ name: "crop.jpg" });
    assert.deepEqual(predictions.map(({ label }) => label), ["rust", "healthy"]);
    assert.ok(Math.abs(predictions[0].confidence - (name === "leaf disease" ? 0.8 : 0.7310586)) < 1e-6);
    assert.ok(Math.abs(predictions[1].confidence - (name === "leaf disease" ? 0.2 : 0.2689414)) < 1e-6);
    await classifier({ name: "crop-again.jpg" });
    assert.equal(sessionCreations, 1);
    assert.equal(labelFetches, 1);
    assert.equal(runCount, 2);
    assert.deepEqual(receivedTensor.dims, [1, 3, imageSize, imageSize]);
    assert.deepEqual([drawArguments[0].width, drawArguments[0].height], [600, 400]);
    const expectedDrawArguments = name === "leaf disease"
      ? [100, 0, 400, 400, 0, 0, 224, 224]
      : [0, 0, 600, 400, 0, 0, 224, 224];
    drawArguments.slice(1).forEach((value, index) => {
      assert.ok(Math.abs(value - expectedDrawArguments[index]) < 1e-8);
    });
    const expectedFirstValue = name === "leaf disease"
      ? 12 / 255
      : (12 / 255 - 0.485) / 0.229;
    assert.ok(Math.abs(receivedTensor.data[0] - expectedFirstValue) < 1e-6);
    assert.equal(canvas.width, imageSize);
    assert.equal(runtime.env.wasm.wasmPaths, "/vendor/");
  });
}
