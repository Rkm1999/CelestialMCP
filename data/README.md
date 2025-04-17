# Catalog Data Directory

This directory is where astronomical catalog files are stored.

Run the following command to download the required catalog files:

```bash
npm run fetch-catalogs
```

This will download:
- ngc.csv - OpenNGC Catalog (14,069 objects)
- hygdata_v41.csv - HYG Database v41 (117,949 stars)

The download may take a few minutes depending on your internet connection.

If the catalogs are not present when starting the server, it will attempt to download them automatically.
