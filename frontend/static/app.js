const fileInput = document.getElementById("file");
const preview = document.getElementById("preview");
const button = document.getElementById("predict");
const statusText = document.getElementById("status");
const result = document.getElementById("result");

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  preview.src = URL.createObjectURL(file);
  preview.classList.remove("hidden");
});

button.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) {
    statusText.textContent = "Please choose an image first.";
    return;
  }

  const form = new FormData();
  form.append("file", file);
  button.disabled = true;
  statusText.textContent = "Analyzing…";

  try {
    const response = await fetch("http://127.0.0.1:8000/api/predict", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Prediction failed");

    document.getElementById("disease").textContent = data.prediction.label;
    document.getElementById("confidence").textContent =
      `${data.prediction.confidence}% confidence`;

    document.getElementById("top3").innerHTML =
      data.top3.map(x => `<li>${x.label} — ${x.confidence}%</li>`).join("");

    document.getElementById("symptoms").innerHTML =
      data.knowledge.symptoms.map(x => `<li>${x}</li>`).join("");

    document.getElementById("advice").textContent = data.knowledge.advice;
    document.getElementById("warning").textContent = data.warning;
    result.classList.remove("hidden");
    statusText.textContent = "Done.";
  } catch (err) {
    statusText.textContent = err.message;
  } finally {
    button.disabled = false;
  }
});
