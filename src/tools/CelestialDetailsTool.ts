import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { OBSERVER_CONFIG } from '../config.js';
import {
  getEquatorialCoordinates,
  getObjectDetails,
  convertToAltAz, // Added this import
  EquatorialCoordinates
} from '../utils/astronomy.js';
import * as Astronomy from 'astronomy-engine';

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
      if (details) {
        const formatTime = (timeObj: Date | Astronomy.AstroTime | null | undefined): string => {
          if (!timeObj) return "N/A";
          // AstroTime objects have a .date property which is a JS Date.
          // Fixed objects might return JS Date directly for riseTime/setTime.
          const date = timeObj instanceof Date ? timeObj : new Date((timeObj as Astronomy.AstroTime).date);
          return date.toLocaleTimeString();
        };

        let note = "";
        if (details.isCircumpolar) {
          if (details.alwaysAboveHorizon) {
            note = "This object is circumpolar and remains above the horizon from this location.";
          } else if (details.alwaysBelowHorizon) {
            note = "This object is circumpolar and remains below the horizon from this location.";
          } else {
            note = "This object is circumpolar from this location.";
          }
        } else {
          // Not circumpolar. Check if it doesn't rise/set and transit is below horizon.
          if (!details.riseTime && !details.setTime &&
              details.transitTime && details.transitTime.hor && details.transitTime.hor.altitude < 0) {
            note = "This object does not rise above the horizon on this date from this location.";
          }
        }
        
        const riseStr = formatTime(details.riseTime);
        // details.transitTime is an event object like { time: AstroTime | Date, hor: HorizontalCoordinates }
        const transitStr = formatTime(details.transitTime ? details.transitTime.time : null);
        const setStr = formatTime(details.setTime);

        if (riseStr === "N/A" && transitStr === "N/A" && setStr === "N/A" && !note) {
            note = "Rise, transit, and set times are not available for this object on this date at this location.";
        }

        response.visibilityTimes = {
          rise: riseStr,
          transit: transitStr,
          set: setStr
        };
          
        if (note) response.visibilityTimes.note = note;
      } else {
        response.visibilityTimes = {
          note: "Astronomical details, including rise/set times, could not be determined for this object."
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