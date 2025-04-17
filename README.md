# Celestial Position MCP Server

An MCP (Model Context Protocol) server that provides altitude-azimuth coordinates for celestial objects using the current system time and a configured location.

## Features

- Get altitude and azimuth coordinates for various celestial objects
- Uses system time by default (with option to specify custom time)
- Uses configurable location settings
- Supports a wide range of celestial objects:
  - Solar system objects (Sun, Moon, planets)
  - Over 117,000 stars from the HYG Database
  - Over 14,000 deep sky objects from the OpenNGC catalog
  - Includes Messier, NGC, and IC objects
- Raw coordinates without atmospheric refraction correction
- Fast lookup with efficient database management

## Installation

1. Make sure you have Node.js and npm installed
2. Clone this repository
3. Install dependencies:
   ```bash
   npm install
   ```

## Catalog Setup

The server exclusively uses astronomical catalogs from the `/data` directory. The catalog loading process follows this order:

1. **Use downloaded catalogs from `/data` directory**:
   ```bash
   npm run fetch-catalogs
   ```
   This downloads catalog files directly to the `data` directory:
   - `ngc.csv` - OpenNGC Catalog (14,069 objects)
   - `hygdata_v41.csv` - HYG Database v41 (117,949 stars)

2. **Automatic download**: If no catalogs are found when starting the server, it will attempt to download them automatically.

3. **Fallback catalogs**: If download fails, the server falls back to sample catalogs or hardcoded data.

## Configuration

Before using the server, update your location in `src/config.ts`:

```typescript
export const OBSERVER_CONFIG = {
  latitude: 49.2827, // Vancouver latitude (replace with your latitude)
  longitude: -123.1207, // Vancouver longitude (replace with your longitude)
  altitude: 30, // Elevation in meters
  temperature: 15, // Default temperature in Celsius
  pressure: 1013.25 // Default pressure in hPa
};

export const SERVER_CONFIG = {
  port: 3005, // The server port
  host: 'localhost'
};
```

## Usage

1. Build the project:
   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. The server will start at http://localhost:3005/mcp
4. Use the included test page at test.html to try out the APIs

## Testing

Open `test.html` in your browser to access a simple interface for testing the server's functionality. You can:
- Look up the position of any celestial object
- List available objects by category
- Test with custom date/time settings

## Available Tools

### getCelestialPosition

Gets altitude and azimuth coordinates for a celestial object.

Parameters:
- `objectName` (required): Name of the celestial object (e.g., "Jupiter", "Sirius", "M31")
- `useSystemTime` (optional, default: true): Whether to use the current system time
- `dateTime` (optional): Custom observation time in ISO format (only used if useSystemTime is false)
  - Use format like "2025-04-15T21:30:00Z" for UTC time
  - Use format like "2025-04-15T21:30:00" for local time (system timezone)

### listCelestialObjects

Lists available celestial objects by category.

Parameters:
- `category` (optional, default: "all"): Filter by category ("planets", "stars", "dso", "all")

## Using with Claude

### Manual Connection

1. Start the server using `npm start` or `npm run dev`
2. Enable developer mode in Claude Desktop
3. Add your MCP server: http://localhost:3005/mcp
4. Ask Claude to get celestial positions

### Auto-Start Configuration

To have Claude automatically start the celestial position server:

1. Build the project first:
   ```bash
   npm run build
   ```

2. Add the following to your Claude MCP configuration:
   ```javascript
   mcp_config = {
     "mcpServers": {
       // Your other servers here...
       
       "celestial-position": {
         "command": "node",
         "args": [
           "C:\\Users\\ryu\\mcp_local\\celestialPosition\\dist\\index.js"
         ]
       }
     }
   }
   ```

3. Adjust the path in the `args` array to match the actual location of your project

Now you can ask Claude questions like:
- "Where is Jupiter in the sky right now?"
- "What's the position of Sirius?"
- "Can I see M31 from my location tonight?"

### Adding to Existing MCP Configuration

If you already have an MCP configuration with other servers, simply add the celestial-position entry to your existing configuration:

```javascript
mcp_config = {
    "mcpServers": {
      "filesystem": {
        "command": "npx",
        "args": [
          "-y",
          "@modelcontextprotocol/server-filesystem",
          "C:\\Users\\ryu\\Downloads",
          "C:\\Users\\ryu\\Desktop",
          "C:\\Users\\ryu\\mcp_local"
        ]
      },
      "brave-search": {
        "command": "npx",
        "args": [
          "-y",
          "@modelcontextprotocol/server-brave-search"
        ],
        "env": {
          "BRAVE_API_KEY": "YOUR_API_KEY"
        }
      },
      // Add the celestial-position server here:
      "celestial-position": {
        "command": "node",
        "args": [
          "C:\\Users\\ryu\\mcp_local\\celestialPosition\\dist\\index.js"
        ]
      }
    }
}
```

This will allow Claude to start multiple MCP servers, including your celestial position server.

## Development

To run in development mode with automatic reloading:

```bash
npm run dev
```

## Project Structure

- `src/index.ts` - Entry point
- `src/server.ts` - MCP server implementation
- `src/config.ts` - Location and server configuration
- `src/fetch-catalogs.ts` - Script to download catalog files
- `src/utils/astronomy.ts` - Star and DSO catalog handling and coordinate calculations
- `src/tools/` - Tool implementations (getCelestialPosition, listCelestialObjects)
- `data/` - Astronomical catalog files

## Resources

- MCP Framework: https://github.com/QuantGeekDev/mcp-framework
- Astronomy Engine: https://github.com/cosinekitty/astronomy
- HYG Database v41: https://github.com/astronexus/HYG-Database/tree/master/hyg/CURRENT
- OpenNGC Catalog: https://github.com/mattiaverga/OpenNGC/tree/master/database_files

## License

ISC
