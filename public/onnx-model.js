const DISEASE_MODEL = {
  modelPath: "/models/plant-disease-tamilnadu.onnx",
  labelsPath: "/models/plant-disease-tamilnadu-labels.json",
  imageSize: 224,
  resizeSize: 256,
  resizeMode: "center-crop",
  mean: [0.5, 0.5, 0.5],
  std: [0.5, 0.5, 0.5],
};

const PEST_MODEL = {
  modelPath: "/models/cerealpestaid-mobilenetv3.onnx",
  labelsPath: "/models/cerealpestaid-labels.json",
  imageSize: 224,
  resizeMode: "stretch",
  mean: [0.485, 0.456, 0.406],
  std: [0.229, 0.224, 0.225],
};

export function logitsToProbabilities(logits) {
  if (!logits?.length || Array.from(logits).some((value) => !Number.isFinite(value))) {
    throw new Error("The model returned invalid prediction scores.");
  }
  const maximum = Math.max(...logits);
  const exponentials = Array.from(logits, (value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total === 0) throw new Error("The model returned invalid prediction scores.");
  return exponentials.map((value) => value / total);
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

function imageTensor(pixels, { mean, std }) {
  const planeSize = pixels.length / 4;
  const tensor = new Float32Array(planeSize * 3);
  for (let pixel = 0; pixel < planeSize; pixel += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = pixels[pixel * 4 + channel] / 255;
      tensor[channel * planeSize + pixel] = (value - mean[channel]) / std[channel];
    }
  }
  return tensor;
}

function sourceCrop(bitmap, imageSize, resizeMode, resizeSize = imageSize) {
  if (resizeMode === "stretch") {
    return [0, 0, bitmap.width, bitmap.height];
  }
  const scale = resizeSize / Math.min(bitmap.width, bitmap.height);
  const cropSize = imageSize / scale;
  return [
    (bitmap.width - cropSize) / 2,
    (bitmap.height - cropSize) / 2,
    cropSize,
    cropSize,
  ];
}

export function createOfflineClassifier({
  runtime = globalThis.ort,
  fetchImpl = globalThis.fetch,
  documentRef = globalThis.document,
  bitmapFactory = globalThis.createImageBitmap,
  model = DISEASE_MODEL,
} = {}) {
  let resourcesPromise;

  async function loadResources() {
    if (!runtime?.InferenceSession || !runtime?.Tensor || !fetchImpl) {
      throw new Error("The offline inference runtime is unavailable. Install app dependencies and reload.");
    }

    runtime.env.wasm.wasmPaths = "/vendor/";
    const [labelsResponse, session] = await Promise.all([
      fetchImpl(model.labelsPath),
      runtime.InferenceSession.create(model.modelPath, { executionProviders: ["wasm"] }),
    ]);
    if (!labelsResponse.ok) throw new Error("The offline model labels are missing. Reload while connected to install them.");

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
      canvas.width = model.imageSize;
      canvas.height = model.imageSize;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("This browser cannot prepare the selected image.");

      const crop = sourceCrop(bitmap, model.imageSize, model.resizeMode, model.resizeSize);
      context.drawImage(bitmap, ...crop, 0, 0, model.imageSize, model.imageSize);
      const pixels = context.getImageData(0, 0, model.imageSize, model.imageSize).data;
      const input = new runtime.Tensor(
        "float32",
        imageTensor(pixels, model),
        [1, 3, model.imageSize, model.imageSize],
      );
      const outputs = await session.run({ [session.inputNames[0]]: input });
      const logits = outputs[session.outputNames[0]]?.data;
      return topPredictions(logitsToProbabilities(logits), classNames);
    } finally {
      bitmap.close?.();
    }
  };
}

export function createPestClassifier(options = {}) {
  return createOfflineClassifier({ ...options, model: PEST_MODEL });
}
