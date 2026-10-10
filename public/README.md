# Web App

This directory contains the browser app served by the Node.js server. It is a mobile-first installable PWA with multilingual voice/text intake, a rule-based soil questionnaire, and optional local photo inference.

## Quick Start

From the repository root:

```sh
npm install
npm start
```

Open <http://localhost:4173>. Without generated files at `public/models/crop_disease.onnx` and `public/models/class_names.json`, the app cannot classify leaf photos. Voice recognition and playback use browser/device language services.

## Architecture

- `index.html` defines the app shell and accessible controls.
- `app.js` implements speech recognition, transcript editing, localized intake, speech playback, photo flow, and optional model inference.
- `languages.js` supplies the supported locales and localized UI/status text.
- `onnx-model.js` loads the ONNX Runtime Web model and runs 48×48 RGB image inference locally in the browser.
- `soil-assessment.js` computes a broad rule-based soil/crop assessment; it is not a lab test or disease model.
- `dashboard.js` adds file drop and navigation behavior; `styles.css` provides layout and responsive styling.
- `sw.js` caches the app shell and opportunistically caches ONNX runtime/model assets for offline use after they have been fetched.
- `manifest.webmanifest` and `icons/` provide install metadata and app icons.

The Node server serves this folder and exposes `/api/health`, `/api/intake`, and `/api/tts`; it does not receive leaf photos or run disease classification. See the root README for the current limitations.

## License

No project-wide license is declared in the repository. Do not assume the app code or icons are available for reuse. Browser libraries and other third-party assets have separate licenses.
