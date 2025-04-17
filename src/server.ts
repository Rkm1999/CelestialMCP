import express from 'express';
import cors from 'cors';
import { SERVER_CONFIG, OBSERVER_CONFIG } from './config';
import { getEquatorialCoordinates, convertToAltAz, initializeCatalogs, listCelestialObjects } from './utils/astronomy';

// Create Express app
const app = express();

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Define MCP compatible endpoint
app.post('/mcp', async (req, res) => {
  try {
    console.log('Received request:', req.body);

    // Process MCP request
    const method = req.body.method || '';
    const params = req.body.params || {};
    
    if (method === 'mcp.toolCall') {
      const toolName = params.name || '';
      const args = params.arguments || {};
      
      // Handle each tool
      if (toolName === 'getCelestialPosition') {
        const result = await handleGetCelestialPosition(args);
        res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          result
        });
      } else if (toolName === 'listCelestialObjects') {
        const result = handleListCelestialObjects(args);
        res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          result
        });
      } else {
        throw new Error(`Unknown tool: ${toolName}`);
      }
    } else if (method === 'mcp.discover') {
      // Return server tools and capabilities
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        result: {
          server: {
            name: 'CelestialPositionMCP',
            version: '1.0.0'
          },
          tools: [
            {
              name: 'getCelestialPosition',
              description: 'Get altitude and azimuth coordinates for a celestial object using system time and configured location (no refraction correction)',
              inputSchema: {
                type: 'object',
                properties: {
                  objectName: {
                    type: 'string',
                    description: 'Name of the celestial object (planet, star, messier object, etc.)'
                  },
                  useSystemTime: {
                    type: 'boolean',
                    description: 'Whether to use the current system time (true) or a custom time (false)',
                    default: true
                  },
                  dateTime: {
                    type: 'string',
                    description: 'ISO format date and time for the observation (e.g., "2025-04-15T21:30:00"), only used if useSystemTime is false'
                  }
                },
                required: ['objectName']
              }
            },
            {
              name: 'listCelestialObjects',
              description: 'Get a list of supported celestial objects by category',
              inputSchema: {
                type: 'object',
                properties: {
                  category: {
                    type: 'string',
                    description: 'Filter by category (planets, stars, dso, all)',
                    default: 'all'
                  }
                }
              }
            }
          ]
        }
      });
    } else {
      throw new Error(`Unknown method: ${method}`);
    }
  } catch (error: any) {
    console.error('Error processing request:', error);
    res.status(400).json({
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: -32000,
        message: error.message || 'Unknown error'
      }
    });
  }
});

// Handle getCelestialPosition tool
async function handleGetCelestialPosition(args: any) {
  try {
    const objectName = args.objectName;
    const useSystemTime = args.useSystemTime !== false; // Default to true
    const dateTime = args.dateTime;
    
    // Get the date (either system time or provided time)
    let date;
    if (useSystemTime || !dateTime) {
      // Use current system time in UTC
      date = new Date();
      console.log(`Using current system time: ${date.toISOString()}`);
    } else {
      // Parse the provided dateTime string
      try {
        // If the string contains 'Z', treat as UTC time
        // If it contains '+' or '-', respect the timezone offset
        // Otherwise, interpret as local time
        date = new Date(dateTime);
        
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date format');
        }
        console.log(`Using custom time: ${date.toISOString()} (parsed from ${dateTime})`);
      } catch (error) {
        throw new Error(`Invalid date format: ${dateTime}. Use ISO format like "2025-04-15T21:30:00Z" for UTC time or "2025-04-15T21:30:00" for local time.`);
      }
    }
    
    // Get equatorial coordinates for the object
    const equatorialCoords = await getEquatorialCoordinates(objectName, date);
    
    // Use observer location from config
    const observer = {
      latitude: OBSERVER_CONFIG.latitude,
      longitude: OBSERVER_CONFIG.longitude,
      elevation: OBSERVER_CONFIG.altitude,
      temperature: 0, // Not used anymore
      pressure: 0     // Not used anymore
    };
    
    // Convert to horizontal (altaz) coordinates
    const altazCoords = convertToAltAz(equatorialCoords, observer, date);
    
    // Calculate additional information
    const isAboveHorizon = altazCoords.altitude > 0;
    const visibility = isAboveHorizon 
      ? altazCoords.altitude > 30 
        ? "Excellent visibility" 
        : "Above horizon"
      : "Below horizon (not visible)";
    
    // Format time information - both UTC and local time with proper timezone info
    const utcTimeString = date.toISOString();
    const localTimeString = date.toLocaleString(undefined, { 
      timeZoneName: 'short'
    });
    
    // Calculate LST (Local Sidereal Time) if needed in future versions
    
    // Return the formatted results
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            object: objectName,
            altitude: altazCoords.altitude.toFixed(4) + "°",
            azimuth: altazCoords.azimuth.toFixed(4) + "°",
            observationTime: {
              utc: utcTimeString,
              local: localTimeString
            },
            systemTime: useSystemTime ? "Yes" : "No",
            location: `${OBSERVER_CONFIG.latitude.toFixed(4)}°, ${OBSERVER_CONFIG.longitude.toFixed(4)}°`,
            aboveHorizon: isAboveHorizon ? "Yes" : "No",
            visibility: visibility,
            equatorialCoordinates: {
              rightAscension: equatorialCoords.rightAscension.toFixed(4) + "h",
              declination: equatorialCoords.declination.toFixed(4) + "°"
            },
            refractionApplied: false
          })
        }
      ]
    };
  } catch (error: any) {
    throw new Error(`Failed to calculate celestial position: ${error.message}`);
  }
}

// Handle listCelestialObjects tool
function handleListCelestialObjects(args: any) {
  const category = args.category?.toLowerCase() || 'all';
  
  // Use the astronomy utility function to get objects from catalogs
  const result = listCelestialObjects(category);
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          totalObjectCount: result.reduce((sum, cat) => sum + cat.objects.length, 0),
          categories: result
        })
      }
    ]
  };
}

// Initialize astronomical catalogs
initializeCatalogs();

// Start server
const PORT = SERVER_CONFIG.port;
app.listen(PORT, () => {
  console.log(`\n🔭 Celestial Position MCP Server is running!`);
  console.log(`🚀 Server available at http://${SERVER_CONFIG.host}:${PORT}/mcp`);
  console.log(`📍 Using location: ${OBSERVER_CONFIG.latitude.toFixed(4)}°, ${OBSERVER_CONFIG.longitude.toFixed(4)}°`);
});
