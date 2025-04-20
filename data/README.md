# Catalog Data

This directory is used to store star and deep sky object catalog files. These files are not included in the repository due to their large size.

To download the catalog files, run:

```bash
npm run fetch-catalogs
```

This will download:
- `hygdata_v41.csv` - The HYG star database with ~120,000 stars
- `ngc.csv` - The New General Catalogue with ~14,000 deep sky objects

Alternatively, the project will create small sample catalogs automatically if the main catalog files cannot be found.
