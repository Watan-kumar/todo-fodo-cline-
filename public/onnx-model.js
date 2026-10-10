export const IMAGE_SIZE = 48;

export function rgbaToRgbTensor(rgba) {
  if (!rgba || rgba.length !== IMAGE_SIZE * IMAGE_SIZE * 4) {
    throw new Error("Unexpected image dimensions.");
  }

  const rgb = new Float32Array(IMAGE_SIZE * IMAGE_SIZE * 3);
  for (let source = 0, target = 0; source < rgba.length; source += 4) {
    rgb[target++] = rgba[source];
    rgb[target++] = rgba[source + 1];
    rgb[target++] = rgba[source + 2];
  }
  return rgb;
}

export function topPredictions(scores, classNames, limit = 3) {
  if (!scores || scores.length !== classNames.length || classNames.length === 0) {
    throw new Error("The model output does not match its class labels.");
  }

  return Array.from(scores, (confidence, index) => ({ label: classNames[index], confidence }))
    .filter((prediction) => Number.isFinite(prediction.confidence))
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, limit);
}

export function createOfflineClassifier({
  runtime = globalThis.ort,
  fetchImpl = globalThis.fetch,
  documentRef = globalThis.document,
  bitmapFactory = globalThis.createImageBitmap,
} = {}) {
  let resourcesPromise;

  async function loadResources() {
    if (!runtime?.InferenceSession || !runtime?.Tensor || !fetchImpl) {
      throw new Error("The offline inference runtime is unavailable. Install app dependencies and reload.");
    }

    runtime.env.wasm.wasmPaths = "/vendor/";
    const [labelsResponse, session] = await Promise.all([
      fetchImpl("/models/class_names.json"),
      runtime.InferenceSession.create("/models/crop_disease.onnx", { executionProviders: ["wasm"] }),
    ]);
    if (!labelsResponse.ok) {
      throw new Error("The offline model labels are missing. Export the model and reload this app.");
    }

    const classNames = await labelsResponse.json();
    if (!Array.isArray(classNames) || classNames.length === 0 || classNames.some((name) => typeof name !== "string")) {
      throw new Error("The offline model labels are invalid.");
    }
    return { classNames, session };
  }

  return async function classifyImage(file) {
    resourcesPromise ??= loadResources().catch((error) => {
      resourcesPromise = null;
      throw error;
    });
    const { classNames, session } = await resourcesPromise;
    const bitmap = await bitmapFactory(file);
    try {
      const canvas = documentRef.createElement("canvas");
      canvas.width = IMAGE_SIZE;
      canvas.height = IMAGE_SIZE;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("This browser cannot prepare the selected image.");

      context.drawImage(bitmap, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
      const pixels = context.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data;
      const input = new runtime.Tensor("float32", rgbaToRgbTensor(pixels), [1, IMAGE_SIZE, IMAGE_SIZE, 3]);
      const output = await session.run({ [session.inputNames[0]]: input });
      return topPredictions(output[session.outputNames[0]].data, classNames);
    } finally {
      bitmap.close?.();
    }
  };
}
