# CelestialMCP Catalog Data

This directory contains star and deep sky object (DSO) catalogs used by the CelestialMCP project.

- `hygdata_v41.csv` - The HYG star database with ~120,000 stars
- `ngc.csv` - The New General Catalogue with ~14,000 deep sky objects

If the main catalog files are not found upon startup, the application will attempt to download them automatically by running the `npm run fetch-catalogs` script. If the download fails or is skipped, and no catalog files (including `sample_stars.csv` and `sample_dso.csv`) are present in the `data/` directory, the respective catalogs will be empty. For basic functionality with sample data, ensure `sample_stars.csv` and `sample_dso.csv` are present if main catalogs are unavailable.
