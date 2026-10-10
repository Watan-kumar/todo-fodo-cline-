import assert from "node:assert/strict";
import test from "node:test";
import { createOfflineClassifier, rgbaToRgbTensor, topPredictions } from "../public/onnx-model.js";

test("RGBA pixels become RGB float inputs without normalization", () => {
  const rgba = new Uint8ClampedArray(48 * 48 * 4);
  rgba.set([12, 34, 56, 255]);
  const rgb = rgbaToRgbTensor(rgba);

  assert.equal(rgb.length, 48 * 48 * 3);
  assert.deepEqual(Array.from(rgb.slice(0, 3)), [12, 34, 56]);
});

test("top predictions pair sorted scores with their matching labels", () => {
  assert.deepEqual(topPredictions([0.1, 0.8, 0.4], ["a", "b", "c"]), [
    { label: "b", confidence: 0.8 },
    { label: "c", confidence: 0.4 },
    { label: "a", confidence: 0.1 },
  ]);
  assert.throws(() => topPredictions([0.2], ["a", "b"]), /does not match/i);
});

test("classifier loads a local ONNX model once and runs image inference on-device", async () => {
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
        assert.equal(path, "/models/crop_disease.onnx");
        assert.deepEqual(options, { executionProviders: ["wasm"] });
        return {
          inputNames: ["leaf"],
          outputNames: ["scores"],
          async run(inputs) {
            runCount += 1;
            receivedTensor = inputs.leaf;
            return { scores: { data: Float32Array.from([0.2, 0.8]) } };
          },
        };
      },
    },
  };
  let labelFetches = 0;
  const fetchImpl = async (path) => {
    labelFetches += 1;
    assert.equal(path, "/models/class_names.json");
    return { ok: true, json: async () => ["healthy", "rust"] };
  };
  const rgba = new Uint8ClampedArray(48 * 48 * 4);
  rgba.set([12, 34, 56, 255]);
  const documentRef = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            drawImage() {},
            getImageData() { return { data: rgba }; },
          };
        },
      };
    },
  };
  const classifier = createOfflineClassifier({
    runtime,
    fetchImpl,
    documentRef,
    bitmapFactory: async () => ({ close() {} }),
  });

  const predictions = await classifier({ name: "leaf.jpg" });
  assert.deepEqual(predictions.map(({ label }) => label), ["rust", "healthy"]);
  assert.ok(Math.abs(predictions[0].confidence - 0.8) < 1e-6);
  assert.ok(Math.abs(predictions[1].confidence - 0.2) < 1e-6);
  await classifier({ name: "leaf-again.jpg" });
  assert.equal(sessionCreations, 1);
  assert.equal(labelFetches, 1);
  assert.equal(runCount, 2);
  assert.deepEqual(receivedTensor.dims, [1, 48, 48, 3]);
  assert.deepEqual(Array.from(receivedTensor.data.slice(0, 3)), [12, 34, 56]);
  assert.equal(runtime.env.wasm.wasmPaths, "/vendor/");
});
