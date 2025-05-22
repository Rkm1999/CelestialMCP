# CelestialMCP
[![smithery badge](https://smithery.ai/badge/@Rkm1999/CelestialMCP)](https://smithery.ai/server/@Rkm1999/CelestialMCP)

A Model Context Protocol (MCP) server for Claude AI that provides tools for calculating celestial object positions, rise/set times, and other astronomical data.

## Overview

CelestialMCP is built with the mcp-framework and leverages the astronomy-engine library to provide accurate astronomical calculations. It offers several tools for determining positions of celestial objects, calculating their rise and set times, and listing available objects from star and deep sky object catalogs.

### Features

- **Celestial Position Calculations**: Get altitude and azimuth coordinates for any celestial object from a specified location on Earth
- **Rise/Set Time Calculations**: Find when celestial objects rise, transit, and set from a specific location
- **Detailed Object Information**: Get comprehensive information about celestial objects including:
  - Distance (for solar system objects)
  - Phase information (for Moon and planets)
  - Upcoming lunar phases (for Moon)
- **Extensive Object Catalog**: Includes:
  - Solar system objects (Sun, Moon, planets)
  - 5,500+ stars from the HYG database
  - 14,000+ deep sky objects from the NGC catalog

### Tools

The package contains three main tools:

1. **getCelestialPosition**: Calculates altitude/azimuth coordinates for a celestial object
2. **getCelestialDetails**: Provides detailed information about a celestial object
3. **listCelestialObjects**: Returns a list of available celestial objects by category

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

## Using with Claude Desktop

### Installing via Smithery

To install Celestial Positioning Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@Rkm1999/CelestialMCP):

```bash
npx -y @smithery/cli install @Rkm1999/CelestialMCP --client claude
```

### Local Development

Add this configuration to your Claude Desktop config file:

**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "CelestialMCP": {
      "command": "node",
      "args":["/absolute/path/to/CelestialMCP/dist/index.js"]
    }
  }
}
```

### Catalog Data

This project includes a script to fetch astronomy catalog data:

```bash
# Fetch star and deep sky object catalogs
npm run fetch-catalogs
```

This will download the HYG star database and NGC deep sky object catalog to the `data/` directory.

## Tool Usage

Here are some examples of using the tools with Claude:

### Getting Object Position

Ask Claude: "What is the current position of Jupiter in the sky from Vancouver?"

### Getting Object Details

Ask Claude: "When does the Moon rise and set today in Vancouver?"

### Listing Available Objects

Ask Claude: "Show me a list of stars I can look up."

## Project Structure

```
CelestialMCP/
├── src/
│   ├── tools/            # MCP Tools
│   │   ├── CelestialPositionTool.ts
│   │   ├── CelestialDetailsTool.ts
│   │   └── ListCelestialObjectsTool.ts
│   ├── utils/
│   │   └── astronomy.ts  # Core astronomy calculations
│   ├── config.ts         # Observer configuration
│   └── index.ts          # Server entry point
├── scripts/
│   └── fetch-catalogs.js # Script to download star catalogs
├── data/                 # Catalog data files
│   ├── hygdata_v41.csv   # HYG star database
│   └── ngc.csv           # New General Catalogue
├── package.json
└── tsconfig.json
```

## Default Configuration

By default, the observer's location is set to Vancouver, Canada. You can change this in `src/config.ts`:

```typescript
export const OBSERVER_CONFIG = {
  latitude: 49.2827,    // Observer latitude
  longitude: -123.1207, // Observer longitude
  altitude: 30,         // Observer altitude in meters
  temperature: 15,      // Default temperature in Celsius
  pressure: 1013.25     // Default pressure in hPa
};
```

## License

MIT

## Acknowledgements

- [astronomy-engine](https://github.com/cosinekitty/astronomy) for core astronomical calculations
- [mcp-framework](https://github.com/QuantGeekDev/mcp-framework) for the MCP server implementation
- HYG Database for star data
- OpenNGC for deep sky object data
