# Project Scripts

This folder contains small repository-maintenance scripts.

## Quick Start

Run the structure check from the repository root:

```sh
python3 scripts/check_project.py
```

It returns a non-zero exit code and lists required source/documentation files that are missing. It does not install dependencies, verify model accuracy, or replace `npm test`.

## Architecture

`check_project.py` checks the tracked app, model-pipeline, folder README, and source-reference entry points. It intentionally does not require local datasets, Python packages, generated models, or `node_modules`.

## License

No project-wide license is declared in the repository. The script is part of the project and does not grant separate reuse rights.
