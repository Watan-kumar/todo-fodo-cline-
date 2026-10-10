// Progressive enhancements for the dashboard; inference and voice stay in app.js.
export function initDashboard({ document = globalThis.document, window = globalThis.window } = {}) {
  const input = document.querySelector("#crop-photo");
  const drop = document.querySelector("#photo-drop");
  const trigger = document.querySelector("#scan-trigger");
  const status = document.querySelector("#model-status");
  trigger.addEventListener("click", () => input.click());

  for (const type of ["dragenter", "dragover"]) {
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.add("is-dragging");
    });
  }
  drop.addEventListener("dragleave", () => drop.classList.remove("is-dragging"));
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("is-dragging");
    const files = event.dataTransfer?.files;
    if (files?.length !== 1 || !files[0].type.startsWith("image/")) {
      status.textContent = "Drop one image file at a time, or choose a leaf photo from your device.";
      return;
    }
    input.files = files;
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  });

  const links = [...document.querySelectorAll(".main-nav a")];
  function updateNavigation() {
    const hash = window.location.hash || "#main-content";
    for (const link of links) {
      if (link.getAttribute("href") === hash) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  }
  window.addEventListener("hashchange", updateNavigation);
  updateNavigation();
}

if (typeof window !== "undefined" && typeof document !== "undefined") initDashboard();