import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { OBSERVER_CONFIG } from '../config.js';
import {
  getEquatorialCoordinates,
  getObjectDetails,
  convertToAltAz, // Added this import
  EquatorialCoordinates
} from '../utils/astronomy.js';

interface CelestialDetailsInput {
  objectName: string;
  // Removed: useSystemTime, dateTime, latitude, longitude, elevation
}

class CelestialDetailsTool extends MCPTool<CelestialDetailsInput> {
  name = 'getCelestialDetails';
  description = "Retrieves detailed astronomical information for a specified celestial object (e.g., planet, star, Messier object, NGC/IC object). Information includes current equatorial and horizontal (altitude/azimuth) coordinates, visibility status (above/below horizon), rise/transit/set times, and, where applicable, distance, phase illumination, and upcoming moon phases. All calculations are performed for the pre-configured observer location and the current system time. The tool automatically resolves common names (e.g., 'Andromeda Galaxy' to 'M31') and handles various catalog identifiers.";
  
  protected schema = {
    objectName: {
      type: z.string(),
      description: "The name or catalog identifier of the celestial object. Examples: 'Jupiter', 'Sirius', 'M31', 'NGC 7000', 'Crab Nebula'. The tool will attempt to resolve common names."
    }
    // Removed: useSystemTime, dateTime, latitude, longitude, elevation
  };

  async execute(params: CelestialDetailsInput) {
    try {
      // Always use current system time
      const date = new Date();

      // Always use pre-configured observer location
      const observer = {
        latitude: OBSERVER_CONFIG.latitude,
        longitude: OBSERVER_CONFIG.longitude,
        elevation: OBSERVER_CONFIG.altitude,
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

      // Convert to horizontal (altaz) coordinates (NEW)
      const altazCoords = convertToAltAz(equatorialCoords, observer, date);
      
      // Get detailed information
      const details = getObjectDetails(params.objectName, date, observer);
      
      // Format the location for display
      const locationName = `Configured (${OBSERVER_CONFIG.latitude.toFixed(4)}°, ${OBSERVER_CONFIG.longitude.toFixed(4)}°)`;
      
      // Calculate visibility (NEW)
      const isAboveHorizon = altazCoords.altitude > 0;
      const visibility = isAboveHorizon
        ? altazCoords.altitude > 30
          ? "Excellent visibility"
          : "Above horizon"
        : "Below horizon (not visible)";

      // Format the response
      const response: any = {
        object: params.objectName,
        observationTime: date.toLocaleString() + " (system local time)",  
        location: locationName,
        coordinates: {
          equatorial: {
            rightAscension: equatorialCoords.rightAscension.toFixed(4) + "h",
            declination: equatorialCoords.declination.toFixed(4) + "°"
          },
          // Added altitude and azimuth to response
          horizontal: {
              altitude: altazCoords.altitude.toFixed(4) + "°",
              azimuth: altazCoords.azimuth.toFixed(4) + "°"
          }
        },
        // Added these fields
        aboveHorizon: isAboveHorizon ? "Yes" : "No",
        visibility: visibility
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