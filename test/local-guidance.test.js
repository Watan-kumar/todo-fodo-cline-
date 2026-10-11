import assert from "node:assert/strict";
import test from "node:test";
import { getLocalGuidance, localGuidanceThreshold } from "../public/local-guidance.js";

test("low model scores prompt a repeat photo and local confirmation", () => {
  const result = getLocalGuidance({
    source: "disease",
    label: "Tomato___Late_blight",
    confidence: localGuidanceThreshold() - 0.01,
    language: "hi-IN",
  });
  assert.match(result.text, /मॉडल का स्कोर कम है/);
  assert.match(result.text, /इस नतीजे पर भरोसा न करें/);
});

test("scores from 70% up to 85% still get uncertain guidance", () => {
  const result = getLocalGuidance({
    source: "disease",
    label: "Tomato___Late_blight",
    confidence: 0.75,
    language: "hi-IN",
  });
  assert.match(result.text, /मॉडल का संकेत स्पष्ट नहीं है/);
});

test("healthy leaf signal recommends monitoring rather than treatment", () => {
  const result = getLocalGuidance({
    source: "disease",
    label: "Tomato___healthy",
    confidence: 0.9,
    language: "te-IN",
  });
  assert.equal(result.category, "healthy");
  assert.match(result.text, /క్రమం తప్పకుండా పరిశీలించండి/);
  assert.match(result.text, /పురుగుమందులు వాడవద్దు/);
});

test("spider-mite class points to leaf undersides and preserving beneficial insects", () => {
  const result = getLocalGuidance({
    source: "disease",
    label: "Tomato___Spider_mites Two-spotted_spider_mite",
    confidence: 0.9,
    language: "ta-IN",
  });
  assert.match(result.text, /இலைகளின் அடிப்புறத்தில்/);
  assert.match(result.text, /நன்மை செய்யும் பூச்சிகளைப் பாதுகாக்கவும்/);
});

test("beneficial insect classes warn against killing them", () => {
  const result = getLocalGuidance({
    source: "pest",
    label: "predators",
    confidence: 0.9,
    language: "kn-IN",
  });
  assert.match(result.text, /ಉಪಕಾರಿ ಅಥವಾ ಸಾಮಾನ್ಯ ಕೀಟ/);
  assert.match(result.text, /ಕೊಲ್ಲಬೇಡಿ/);
});

test("pest guidance requests field counts and local IPM advice without pesticide dosing", () => {
  const result = getLocalGuidance({
    source: "pest",
    label: "russian_wheat_aphid",
    confidence: 0.9,
    language: "mr-IN",
  });
  assert.match(result.text, /अनेक झाडांवर/);
  assert.match(result.text, /एकात्मिक कीड व्यवस्थापनाचा सल्ला/);
  assert.doesNotMatch(result.text, /\d+\s*(ml|g|kg|लिटर|ग्रॅम)/i);
});

test("unsupported sources, scores and locales fail closed", () => {
  const input = { source: "disease", label: "healthy", confidence: 0.8, language: "en-US" };
  assert.throws(() => getLocalGuidance(input), /supported language/i);
  assert.throws(() => getLocalGuidance({ ...input, language: "hi-IN", source: "weather" }), /source/i);
  assert.throws(() => getLocalGuidance({ ...input, language: "hi-IN", confidence: 1.1 }), /confidence/i);
});
