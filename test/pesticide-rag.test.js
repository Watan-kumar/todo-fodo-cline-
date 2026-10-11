import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDiagnosisPrompt,
  isVerifiedPesticideRow,
  parseDiagnosisReport,
  retrievePesticideRows,
} from "../pesticide-rag.js";

const now = Date.parse("2026-10-11T00:00:00Z");
const validRow = {
  verified: true,
  className: "Tomato___Late_blight",
  state: "Maharashtra",
  optionType: "organic",
  product: "Example formulation",
  dose: "Follow the current state advisory",
  preHarvestIntervalDays: 0,
  registrationNumber: "CIBRC-123",
  sourceTitle: "Example State Agriculture University advisory",
  sourceUrl: "https://agri.maharashtra.gov.in/advisory",
  verifiedAt: "2026-10-01T00:00:00Z",
};

test("pesticide retrieval requires an exact disease/state and current official source", () => {
  assert.equal(isVerifiedPesticideRow(validRow, now), true);
  assert.equal(retrievePesticideRows([validRow], {
    className: validRow.className,
    state: validRow.state,
  }, now).length, 1);
  assert.equal(retrievePesticideRows([validRow], {
    className: validRow.className,
    state: "Punjab",
  }, now).length, 0);
  assert.equal(isVerifiedPesticideRow({ ...validRow, sourceUrl: "https://example.com/advisory" }, now), false);
  assert.equal(isVerifiedPesticideRow({ ...validRow, verifiedAt: "2025-01-01T00:00:00Z" }, now), false);
  assert.equal(isVerifiedPesticideRow({ ...validRow, dose: "" }, now), false);
  assert.equal(isVerifiedPesticideRow({ ...validRow, state: "Neverland" }, now), false);
  assert.equal(isVerifiedPesticideRow({ ...validRow, verifiedAt: "2026-99-99T00:00:00Z" }, now), false);
});

test("report prompt keeps pesticide names and doses out of generated report fields", () => {
  const prompt = buildDiagnosisPrompt({
    language: "hi-IN",
    label: "Tomato___Late_blight",
    confidence: 0.8,
    notes: "Brown spots",
  });
  assert.match(prompt, /entirely in Hindi \(हिन्दी\), not English/i);
  assert.match(prompt, /Do not include pesticide, fungicide, insecticide, brand, chemical, product, dose/i);
  assert.doesNotMatch(prompt, /Example formulation|CIBRC-123/);
});

test("report parser accepts only complete structured text fields", () => {
  assert.deepEqual(parseDiagnosisReport(JSON.stringify({
    symptoms: "Spots",
    possibleCause: "A possible infection",
    prevention: "Monitor plants",
  })), {
    symptoms: "Spots",
    possibleCause: "A possible infection",
    prevention: "Monitor plants",
  });
  assert.throws(() => parseDiagnosisReport("Not JSON"), /valid JSON/i);
  assert.throws(() => parseDiagnosisReport(JSON.stringify({ symptoms: "x" })), /incomplete/i);
  assert.throws(() => parseDiagnosisReport(JSON.stringify({
    symptoms: "Spots",
    possibleCause: "Mancozeb may help",
    prevention: "Monitor plants",
  })), /treatment content/i);
  assert.throws(() => parseDiagnosisReport(JSON.stringify({
    symptoms: "पत्तियों पर धब्बे",
    possibleCause: "देर से झुलसा रोग हो सकता है",
    prevention: "उचित उपचार के साथ नियमित रूप से उपचार करें",
  }), "hi-IN"), /treatment content/i);
  assert.throws(() => parseDiagnosisReport(JSON.stringify({
    symptoms: "पानांवर डाग",
    possibleCause: "बुरशीचा रोग असू शकतो",
    prevention: "फवारणी करा",
  }), "mr-IN"), /treatment content/i);
  assert.throws(() => parseDiagnosisReport(JSON.stringify({
    symptoms: "Spots",
    possibleCause: "A possible infection",
    prevention: "Monitor plants",
  }), "hi-IN"), /requested language/i);
  assert.deepEqual(parseDiagnosisReport(JSON.stringify({
    symptoms: "पत्तियों पर धब्बे",
    possibleCause: "देर से झुलसा रोग हो सकता है",
    prevention: "खेत की नियमित निगरानी करें",
  }), "hi-IN"), {
    symptoms: "पत्तियों पर धब्बे",
    possibleCause: "देर से झुलसा रोग हो सकता है",
    prevention: "खेत की नियमित निगरानी करें",
  });
});
