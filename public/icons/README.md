# App Icons

This folder holds the KhetSuno PWA icons referenced by `public/index.html` and `public/manifest.webmanifest`.

## Quick Start

Use the existing icon paths in the app manifest when changing the artwork. Keep the SVG and raster variants visually consistent and verify the installed-app icon on a phone after updates.

## Architecture

The SVG is the scalable browser favicon. The 192 px and 512 px PNG files are install icons declared in the web manifest. These files are static assets; they do not affect app behavior or model inference.

## License

The repository has no root `LICENSE` file and does not declare an icon-specific license or provenance record. Confirm ownership and permission before reusing or redistributing these files.
