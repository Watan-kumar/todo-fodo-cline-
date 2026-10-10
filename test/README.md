# Tests

This folder contains dependency-light automated tests for the Node.js server and browser modules.

## Quick Start

From the repository root, run:

```sh
npm test
```

The suite uses Node's built-in test runner. It does not need a trained model or downloaded dataset; model-related tests use injected/fake browser runtime dependencies where appropriate.

## Architecture

- `server.test.js` exercises HTTP intake, language validation, health, and static serving.
- `voice-flow.test.js` exercises the voice, text, transcript-editing, and playback flow with DOM/Web Speech test doubles.
- `onnx-model.test.js` covers image tensor conversion, prediction ordering, and model-loading behavior.
- `soil-assessment.test.js` checks soil input validation and rule-based output.
- `dashboard.test.js` checks dashboard interactions.

The tests validate prototype behavior and do not establish agronomic correctness or field accuracy.

## License

No project-wide license is declared in the repository. No separate test-data license is declared here; the current test suite uses synthetic fixtures and local test doubles.
