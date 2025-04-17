# Installation and Setup Guide

This guide will help you set up and run the Celestial Position MCP Server.

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

## Step 1: Install Dependencies

Open a terminal/command prompt in the project directory and run:

```bash
npm install
```

This will install all required dependencies including:
- mcp-framework
- astronomy-engine
- TypeScript and related tools

## Step 2: Configure Your Location

Before running the server, update your location in `src/config.ts`:

1. Open the file `src/config.ts` in a text editor
2. Modify the `OBSERVER_CONFIG` object with your location:
   ```typescript
   export const OBSERVER_CONFIG = {
     latitude: YOUR_LATITUDE, // e.g., 35.6762 for Tokyo
     longitude: YOUR_LONGITUDE, // e.g., 139.6503 for Tokyo
     altitude: YOUR_ELEVATION, // in meters above sea level
     temperature: 15, // default temperature in Celsius
     pressure: 1013.25 // default pressure in hPa
   };
   ```

You can find your latitude and longitude using:
- Google Maps (right-click on your location and select "What's here?")
- Online services like https://www.latlong.net/

## Step 3: Build the Project

Compile the TypeScript code to JavaScript:

```bash
npm run build
```

This will create a `dist` folder with the compiled JavaScript files.

## Step 4: Start the Server

Start the MCP server:

```bash
npm start
```

You should see output similar to:

```
🚀 MCP Server started at http://localhost:3000
📝 Inspector available at http://localhost:3000/inspector

Available tools:
- getCelestialPosition: Get altitude and azimuth coordinates for a celestial object
- listCelestialObjects: Get a list of supported celestial objects

🔭 Celestial Position MCP Server is ready!
```

## Step 5: Test the Server

You can test your server using the built-in MCP Inspector:

1. Open your web browser and navigate to http://localhost:3000/inspector
2. Try out the available tools:
   - `getCelestialPosition` with parameter `objectName: "Jupiter"`
   - `listCelestialObjects` with parameter `category: "all"`

## Step 6: Connect to Claude Desktop

To use this MCP server with Claude:

1. Open Claude Desktop
2. Go to Settings > Developer
3. Enable Developer Mode
4. Add your local MCP server: http://localhost:3000
5. In a conversation with Claude, ask about celestial positions

Example questions for Claude:
- "What's the current position of Jupiter in the sky?"
- "Can you tell me where Sirius is right now?"
- "What deep sky objects are currently visible from my location?"

## Troubleshooting

- **Server won't start**: Make sure nothing else is running on port 3000. You can change the port in `src/config.ts`.
- **Connection errors**: Ensure your firewall isn't blocking local connections.
- **Object not found**: Check the spelling of celestial objects or use `listCelestialObjects` to see available objects.
