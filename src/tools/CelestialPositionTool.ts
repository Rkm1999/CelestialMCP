import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { OBSERVER_CONFIG } from '../config.js';
import { 
  getEquatorialCoordinates, 
  convertToAltAz,
  EquatorialCoordinates
} from '../utils/astronomy.js';

interface CelestialPositionInput {
  objectName: string;
  useSystemTime: boolean;
  dateTime?: string;
  temperature?: number;
  pressure?: number;
}

class CelestialPositionTool extends MCPTool<CelestialPositionInput> {
  name = 'getCelestialPosition';
  description = 'Get altitude and azimuth coordinates for a celestial object using system time and configured location';
  
  protected schema = {
    objectName: {
      type: z.string(),
      description: 'Name of the celestial object (planet, star, messier object, etc.)'
    },
    useSystemTime: {
      type: z.boolean(),
      description: 'Whether to use the current system time (true) or a custom time (false)'
    },
    dateTime: {
      type: z.string().optional(),
      description: 'ISO format date and time for the observation (e.g., "2025-04-15T21:30:00"), only used if useSystemTime is false'
    },
    temperature: {
      type: z.number().optional(),
      description: 'Temperature in Celsius (for refraction correction)'
    },
    pressure: {
      type: z.number().optional(),
      description: 'Atmospheric pressure in hPa (for refraction correction)'
    }
  };

  async execute(params: CelestialPositionInput) {
    try {
      // Get the date (either system time or provided time)
      let date;
      if (params.useSystemTime || !params.dateTime) {
        // Get current system time - we'll use this directly without timezone adjustments
        // This ensures calculations are correct for the current time
        date = new Date(); 
      } else {
        // Parse the provided date
        date = new Date(params.dateTime);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date format: ${params.dateTime}. Use ISO format like "2025-04-15T21:30:00".`);
        }
      }
      
      // Get equatorial coordinates for the object
      const equatorialCoords = await getEquatorialCoordinates(params.objectName, date);
      
      // Use hardcoded observer location from config
      const observer = {
        latitude: OBSERVER_CONFIG.latitude,
        longitude: OBSERVER_CONFIG.longitude,
        elevation: OBSERVER_CONFIG.altitude,
        temperature: params.temperature || OBSERVER_CONFIG.temperature,
        pressure: params.pressure || OBSERVER_CONFIG.pressure
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
      
      // Format the date simply using the system's local time 
      // This will use the computer's actual timezone rather than calculating a custom one
      const localTimeString = date.toLocaleString();
      
      // Return the formatted results
      return {
        object: params.objectName,
        altitude: altazCoords.altitude.toFixed(4) + "°",
        azimuth: altazCoords.azimuth.toFixed(4) + "°",
        observationTime: localTimeString,
        systemTime: params.useSystemTime ? "Yes" : "No",
        location: `${OBSERVER_CONFIG.latitude.toFixed(4)}°, ${OBSERVER_CONFIG.longitude.toFixed(4)}°`,
        aboveHorizon: isAboveHorizon ? "Yes" : "No",
        visibility: visibility,
        equatorialCoordinates: {
          rightAscension: equatorialCoords.rightAscension.toFixed(4) + "h",
          declination: equatorialCoords.declination.toFixed(4) + "°"
        }
      };
    } catch (error: any) {
      throw new Error(`Failed to calculate celestial position: ${error.message}`);
    }
  }
}

// Export the class directly (not an instance)
export default CelestialPositionTool;
