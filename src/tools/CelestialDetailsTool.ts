import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { OBSERVER_CONFIG } from '../config.js';
import { 
  getEquatorialCoordinates, 
  getObjectDetails,
  EquatorialCoordinates
} from '../utils/astronomy.js';

interface CelestialDetailsInput {
  objectName: string;
  useSystemTime: boolean;
  dateTime?: string;
  latitude?: number;
  longitude?: number;
  elevation?: number;
}

class CelestialDetailsTool extends MCPTool<CelestialDetailsInput> {
  name = 'getCelestialDetails';
  description = 'Get detailed information about a celestial object including rise/set times, phase information, distance, and upcoming moon phases';
  
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
    latitude: {
      type: z.number().optional(),
      description: 'Observer latitude in degrees (optional, defaults to Vancouver)'
    },
    longitude: {
      type: z.number().optional(),
      description: 'Observer longitude in degrees (optional, defaults to Vancouver)'
    },
    elevation: {
      type: z.number().optional(),
      description: 'Observer elevation in meters (optional, defaults to Vancouver)'
    }
  };

  async execute(params: CelestialDetailsInput) {
    try {
      // Get the date (either system time or provided time)
      let date;
      if (params.useSystemTime || !params.dateTime) {
        date = new Date();
      } else {
        // Parse the provided date as UTC
        date = new Date(params.dateTime);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date format: ${params.dateTime}. Use ISO format like "2025-04-15T21:30:00".`);
        }
      }

      // Use provided coordinates or default to configured values
      const observer = {
        latitude: params.latitude || OBSERVER_CONFIG.latitude,
        longitude: params.longitude || OBSERVER_CONFIG.longitude,
        elevation: params.elevation || OBSERVER_CONFIG.altitude,
        temperature: OBSERVER_CONFIG.temperature,
        pressure: OBSERVER_CONFIG.pressure
      };
      
      // Get equatorial coordinates for the object
      let equatorialCoords: EquatorialCoordinates;
      try {
        equatorialCoords = await getEquatorialCoordinates(params.objectName, date);
      } catch (error: any) {
        throw new Error(`Could not find object: ${params.objectName}. ${error.message}`);
      }
      
      // Get detailed information
      const details = getObjectDetails(params.objectName, date, observer);
      
      // Format the location for display
      const locationName = params.latitude ? 
        `Custom (${observer.latitude.toFixed(4)}°, ${observer.longitude.toFixed(4)}°)` : 
        `Vancouver (${OBSERVER_CONFIG.latitude.toFixed(4)}°, ${OBSERVER_CONFIG.longitude.toFixed(4)}°)`;
      
      // Format the response
      const response: any = {
        object: params.objectName,
        observationTime: date.toLocaleString() + " (system local time)",  
        location: locationName,
        coordinates: {
          equatorial: {
            rightAscension: equatorialCoords.rightAscension.toFixed(4) + "h",
            declination: equatorialCoords.declination.toFixed(4) + "°"
          }
        }
      };
      
      // Add rise/set/transit times if available
      if (details && details.riseTime) {
        const riseDate = details.riseTime instanceof Date ? 
          details.riseTime : new Date(details.riseTime.date);
          
        const transitDate = details.transitTime && details.transitTime.time instanceof Date ? 
          details.transitTime.time : 
          details.transitTime && details.transitTime.time ? 
            new Date(details.transitTime.time.date) : null;
            
        const setDate = details.setTime instanceof Date ? 
          details.setTime : new Date(details.setTime.date);
        
        response.visibilityTimes = {
          rise: riseDate.toLocaleTimeString(),
          transit: transitDate ? transitDate.toLocaleTimeString() : "Not visible",
          set: setDate.toLocaleTimeString()
        };
        
        // Add whether the object is currently above the horizon
        const now = new Date();
        const isRising = riseDate <= now && (setDate >= now || setDate <= riseDate);
        response.isAboveHorizon = isRising;
      } else {
        response.visibilityTimes = {
          note: "Rise/set times not available for this object at this location"
        };
      }
      
      // Add distance information if available
      if (details && details.distance) {
        response.distance = {
          astronomicalUnits: details.distance.au.toFixed(6),
          kilometers: Math.round(details.distance.km).toLocaleString()
        };
      }
      
      // Add phase information for solar system objects
      if (details && details.phaseInfo) {
        response.phase = {
          percentIlluminated: details.phaseInfo.phasePercent.toFixed(1) + "%",
          trend: details.phaseInfo.isWaxing ? "Waxing" : "Waning"
        };
      }
      
      // Add moon phase information if this is the Moon
      if (details && details.moonPhases && params.objectName.toLowerCase() === 'moon') {
        response.upcomingPhases = {
          newMoon: new Date(details.moonPhases.nextNewMoon.date).toLocaleDateString(),
          firstQuarter: new Date(details.moonPhases.nextFirstQuarter.date).toLocaleDateString(),
          fullMoon: new Date(details.moonPhases.nextFullMoon.date).toLocaleDateString(),
          lastQuarter: new Date(details.moonPhases.nextLastQuarter.date).toLocaleDateString()
        };
      }
      
      return response;
    } catch (error: any) {
      throw new Error(`Failed to get celestial details: ${error.message}`);
    }
  }
}

// Export the class directly (not an instance)
export default CelestialDetailsTool;
