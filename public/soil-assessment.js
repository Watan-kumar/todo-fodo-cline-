const soilGroups = new Set(["alluvial", "black", "red", "sandy", "clay"]);
const nutrientStatuses = new Set(["not-tested", "low", "medium", "high"]);
const waterStatuses = new Set(["rainfed", "irrigated"]);

const cropsBySoil = {
  alluvial: {
    crops: ["Wheat", "Maize", "Pulses", "Rice (where water is reliable)"],
    note: "a broad shortlist for alluvial or loamy soils",
  },
  black: {
    crops: ["Cotton", "Soybean", "Sorghum", "Pulses"],
    note: "a broad shortlist for black cotton soils",
  },
  red: {
    crops: ["Groundnut", "Millets", "Pulses", "Rice (where water is reliable)"],
    note: "a broad shortlist for red or lateritic soils",
  },
  sandy: {
    crops: ["Groundnut", "Pearl millet", "Pulses"],
    note: "a broad shortlist for sandy or sandy-loam soils",
  },
  clay: {
    crops: ["Sorghum", "Pulses"],
    note: "a broad shortlist for heavy soils",
  },
};

function optionalNumber(value, label, maximum) {
  if (value === "" || value === undefined || value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > maximum) {
    throw new RangeError(`${label} must be between 0 and ${maximum}.`);
  }
  return number;
}

function nutrientLabel(value) {
  if (!nutrientStatuses.has(value)) throw new TypeError("Choose a valid lab status for each nutrient.");
  return value === "not-tested" ? "Not tested" : `${value[0].toUpperCase()}${value.slice(1)} (as reported by lab)`;
}

export function assessSoil({
  ph,
  soilKind,
  organicCarbon = "",
  ec = "",
  nitrogen = "not-tested",
  phosphorus = "not-tested",
  potassium = "not-tested",
  water = "rainfed",
  drainage = "unknown",
  compaction = "unknown",
  earthworms = "unknown",
}) {
  const parsedPh = optionalNumber(ph, "Soil pH", 14);
  if (parsedPh === null) throw new TypeError("Enter the pH from a soil test.");
  if (!soilGroups.has(soilKind)) throw new TypeError("Choose a soil group or texture.");
  if (!waterStatuses.has(water)) throw new TypeError("Choose the growing-season water availability.");

  const parsedCarbon = optionalNumber(organicCarbon, "Organic carbon", 100);
  const parsedEc = optionalNumber(ec, "Electrical conductivity", 100);
  const pHReading = parsedPh < 6
    ? "Acid-side reading; many agronomic crops prefer pH around 6–7, but tolerance differs by crop."
    : parsedPh > 7
      ? "Alkaline-side reading; compare with the chosen crop and your local lab guidance."
      : "Within the broad pH range preferred by many agronomic crops; crop-specific ranges still vary.";

  const indicators = [
    { name: "pH", result: `${parsedPh.toFixed(1)} · ${pHReading}` },
    {
      name: "Soil group / texture",
      result: `${soilKind[0].toUpperCase()}${soilKind.slice(1)} · used only for a broad crop shortlist.`,
    },
    {
      name: "Organic carbon",
      result: parsedCarbon === null
        ? "Not entered."
        : `${parsedCarbon.toFixed(2)}% · ${parsedCarbon < 0.5 ? "Low" : parsedCarbon <= 0.75 ? "Medium" : "High"} in the Indian soil-testing manual's classes.`,
    },
    {
      name: "Electrical conductivity",
      result: parsedEc === null
        ? "Not entered."
        : `${parsedEc.toFixed(2)} dS/m recorded; salinity interpretation depends on crop and local lab guidance.`,
    },
    { name: "Nitrogen", result: nutrientLabel(nitrogen) },
    { name: "Phosphorus", result: nutrientLabel(phosphorus) },
    { name: "Potassium", result: nutrientLabel(potassium) },
  ];

  if (drainage !== "unknown") {
    indicators.push({
      name: "Drainage observation",
      result: drainage === "slow" ? "Water stays or drains slowly; consider a field assessment." : "Reported as draining well.",
    });
  }
  if (compaction !== "unknown") {
    indicators.push({
      name: "Compaction observation",
      result: compaction === "yes" ? "Compaction noticed; consider a field assessment." : "No obvious compaction reported.",
    });
  }
  if (earthworms !== "unknown") {
    indicators.push({
      name: "Earthworm observation",
      result: earthworms === "seen" ? "Earthworms seen; one useful biological observation, not a soil-health grade." : "Not seen; a single observation does not establish biological soil health.",
    });
  }

  const cropProfile = cropsBySoil[soilKind];
  let crops = [...cropProfile.crops];
  if (water === "rainfed") {
    crops = crops.filter((crop) => !crop.startsWith("Rice"));
    if (soilKind === "clay") crops = ["Sorghum", "Pulses"];
  }

  return {
    summary: `Screening completed from the values you entered. This does not produce a single soil-quality grade. Crop suggestions are ${cropProfile.note}${water === "irrigated" ? ", with reliable irrigation reported." : ", with rainfed or limited water reported."}`,
    indicators,
    crops: crops.map((crop) => ({
      name: crop,
      reason: "Indicative option only; verify against district, season, variety, soil-test advice and water supply.",
    })),
  };
}

export function initSoilAssessment(document = globalThis.document) {
  const form = document.querySelector("#soil-form");
  const result = document.querySelector("#soil-result");
  const summary = document.querySelector("#soil-summary");
  const indicators = document.querySelector("#soil-indicators");
  const crops = document.querySelector("#soil-crops");

  function field(name) {
    return document.querySelector(`[name="${name}"]`).value;
  }

  function renderList(target, items) {
    target.replaceChildren(...items.map(({ name, result: detail, reason }) => {
      const item = document.createElement("li");
      item.textContent = reason ? `${name}: ${reason}` : `${name}: ${detail}`;
      return item;
    }));
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const assessment = assessSoil({
        ph: field("ph"),
        soilKind: field("soilKind"),
        organicCarbon: field("organicCarbon"),
        ec: field("ec"),
        nitrogen: field("nitrogen"),
        phosphorus: field("phosphorus"),
        potassium: field("potassium"),
        water: field("water"),
        drainage: field("drainage"),
        compaction: field("compaction"),
        earthworms: field("earthworms"),
      });
      summary.textContent = assessment.summary;
      renderList(indicators, assessment.indicators);
      renderList(crops, assessment.crops);
    } catch (error) {
      summary.textContent = error instanceof Error ? error.message : "Please check the soil test values.";
      indicators.replaceChildren();
      crops.replaceChildren();
    }
    result.hidden = false;
  });
}
