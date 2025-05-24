import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { OBSERVER_CONFIG } from '../config.js';
import {
  getEquatorialCoordinates,
  convertToAltAz,
  STAR_CATALOG,
  EquatorialCoordinates,
  HorizontalCoordinates,
  Observer,
  calculateAngularSeparation,
  calculateBearing,
  SOLAR_SYSTEM_OBJECTS,
  COMMON_NAMES,
  DSO_CATALOG,
} from '../utils/astronomy.js';

interface StarHoppingInput {
  targetObjectName: string;
  fovDegrees: number;
  maxHopMagnitude?: number;
  initialSearchRadiusDegrees?: number;
  startStarMagnitudeThreshold?: number;
}

interface CelestialObjectData extends EquatorialCoordinates {
  id: string; // Unique identifier (e.g., lowercased name or catalog ID)
  altAz?: HorizontalCoordinates; // Optional, calculated when needed
}

class StarHoppingTool extends MCPTool<StarHoppingInput> {
  name = 'getStarHoppingPath';
  description =
    'Calculates a star hopping path from a bright start star to a target celestial object. Each hop is within the specified Field of View (FOV).';

  protected schema = {
    targetObjectName: {
      type: z.string(),
      description:
        'The name or catalog identifier of the celestial object to find (e.g., "M13", "Andromeda Galaxy", "Mars").',
    },
    fovDegrees: {
      type: z.number().positive(),
      description: "The Field of View (FOV) of the user's equipment in degrees.",
    },
    maxHopMagnitude: {
      type: z.number().optional().default(8.0),
      description: 'The maximum (dimmest) stellar magnitude for stars in the hopping path. Default: 8.0.',
    },
    initialSearchRadiusDegrees: {
      type: z.number().positive().optional().default(20.0),
      description:
        'The angular radius around the target object to search for a suitable bright starting star. Default: 20.0 degrees.',
    },
    startStarMagnitudeThreshold: {
      type: z.number().optional().default(3.5),
      description: 'The maximum (dimmest) magnitude for a star to be a good, bright "starting star." Default: 3.5.',
    },
  };

  private formatCoordsForOutput(coords: EquatorialCoordinates) {
    return {
      rightAscension: `${coords.rightAscension.toFixed(2)}h`,
      declination: `${coords.declination.toFixed(2)}°`,
    };
  }

  private formatAltAzForOutput(altAz: HorizontalCoordinates) {
    return {
      altitude: `${altAz.altitude.toFixed(1)}°`,
      azimuth: `${altAz.azimuth.toFixed(1)}°`,
    };
  }

  async execute(params: StarHoppingInput) {
    const date = new Date();
    const observer: Observer = {
      latitude: OBSERVER_CONFIG.latitude,
      longitude: OBSERVER_CONFIG.longitude,
      elevation: OBSERVER_CONFIG.altitude,
      temperature: OBSERVER_CONFIG.temperature,
      pressure: OBSERVER_CONFIG.pressure,
    };

    let targetEquatorial: EquatorialCoordinates;
    try {
      targetEquatorial = await getEquatorialCoordinates(params.targetObjectName, date);
    } catch (error: any) {
      return {
        targetObjectName: params.targetObjectName,
        status: 'TargetNotFound',
        summaryMessage: `Target object "${params.targetObjectName}" not found in catalogs. ${error.message}`,
      };
    }

    const targetAltAz = convertToAltAz(targetEquatorial, observer, date);
    if (targetAltAz.altitude <= 0) {
      return {
        targetObjectName: params.targetObjectName,
        targetCoordinates: {
          ...this.formatCoordsForOutput(targetEquatorial),
          ...this.formatAltAzForOutput(targetAltAz),
        },
        fieldOfViewDegrees: params.fovDegrees,
        status: 'TargetNotVisible',
        summaryMessage: `Target "${params.targetObjectName}" is currently below the horizon.`,
      };
    }

    const targetData: CelestialObjectData = {
      ...targetEquatorial,
      id: params.targetObjectName.toLowerCase(),
      altAz: targetAltAz,
    };

    // Starting Star Selection
    let potentialStartStars: CelestialObjectData[] = [];
    // The above block was removed because it allowed non-star targets (like DSOs)
    // to be considered as starting stars if they had a magnitude, which is incorrect.
    // Starting stars must be actual stars from the STAR_CATALOG.
    for (const [starId, starEq] of STAR_CATALOG.entries()) {
      if (starEq.magnitude === undefined || starEq.magnitude > params.startStarMagnitudeThreshold!) {
        continue;
      }
      const separation = calculateAngularSeparation(starEq, targetEquatorial);
      if (separation > params.initialSearchRadiusDegrees!) {
        continue;
      }
      const starAltAz = convertToAltAz(starEq, observer, date);
      if (starAltAz.altitude <= 0) {
        continue;
      }
      potentialStartStars.push({ ...starEq, id: starId, altAz: starAltAz });
    }

    if (potentialStartStars.length === 0) {
      return {
        targetObjectName: params.targetObjectName,
        targetCoordinates: {
          ...this.formatCoordsForOutput(targetEquatorial),
          ...this.formatAltAzForOutput(targetAltAz),
        },
        fieldOfViewDegrees: params.fovDegrees,
        status: 'NoStartingStarFound',
        summaryMessage: `No suitable starting star found within ${params.initialSearchRadiusDegrees}° of "${params.targetObjectName}" and brighter than magnitude ${params.startStarMagnitudeThreshold}.`,
      };
    }

    potentialStartStars.sort((a, b) => (a.magnitude ?? Infinity) - (b.magnitude ?? Infinity));
    const startStar = potentialStartStars[0];

    const initialSeparationToTarget = calculateAngularSeparation(startStar, targetEquatorial);

    const baseResponse = {
      targetObjectName: params.targetObjectName,
      targetCoordinates: {
        ...this.formatCoordsForOutput(targetEquatorial),
        ...this.formatAltAzForOutput(targetAltAz),
      },
      fieldOfViewDegrees: params.fovDegrees,
      startStar: {
        name: startStar.name!,
        magnitude: startStar.magnitude!,
        ...this.formatCoordsForOutput(startStar),
      },
    };

    if (initialSeparationToTarget <= params.fovDegrees) {
      const bearingToTarget = calculateBearing(startStar, targetEquatorial);
      return {
        ...baseResponse,
        hopSequence: [],
        finalStep: {
          fromStar: { name: startStar.name!, magnitude: startStar.magnitude! },
          message: `The target ${params.targetObjectName} should be within your FOV, approx ${initialSeparationToTarget.toFixed(1)}° towards ${bearingToTarget.cardinal} (Bearing: ${bearingToTarget.degrees}°) from ${startStar.name}.`,
        },
        status: 'TargetInStartFOV',
        summaryMessage: `Target "${params.targetObjectName}" is already within FOV of the starting star "${startStar.name}".`,
      };
    }

    // Star Hopping Algorithm
    const hopSequence: any[] = [];
    let currentHopStar = startStar;
    let currentDistanceToTarget = initialSeparationToTarget;
    const visitedStarIds = new Set<string>([startStar.id]);

    for (let hopNum = 1; hopNum <= 20; hopNum++) { // Max 20 hops to prevent infinite loops
      let bestNextHop: CelestialObjectData | null = null;
      let smallestDistToTargetForNextHop = currentDistanceToTarget;

      for (const [candidateId, candidateEq] of STAR_CATALOG.entries()) {
        if (visitedStarIds.has(candidateId) || candidateId === targetData.id) {
          continue; // Skip already visited or the target itself as an intermediate hop
        }
        if (candidateEq.magnitude === undefined || candidateEq.magnitude > params.maxHopMagnitude!) {
          continue;
        }

        const hopSeparation = calculateAngularSeparation(currentHopStar, candidateEq);
        if (hopSeparation > params.fovDegrees) {
          continue;
        }

        const candidateDistToTarget = calculateAngularSeparation(candidateEq, targetEquatorial);
        if (candidateDistToTarget >= currentDistanceToTarget) { // Must be closer to target
          continue;
        }
        
        const candidateAltAz = convertToAltAz(candidateEq, observer, date);
        if (candidateAltAz.altitude <= 0) {
          continue;
        }

        // Prefer candidate that makes most progress towards target
        if (candidateDistToTarget < smallestDistToTargetForNextHop) {
          smallestDistToTargetForNextHop = candidateDistToTarget;
          bestNextHop = { ...candidateEq, id: candidateId }; // altAz is checked for visibility but not stored in the hop object
        }
      }

      if (bestNextHop) {
        const bearingToNextHop = calculateBearing(currentHopStar, bestNextHop);
        const hopDistance = calculateAngularSeparation(currentHopStar, bestNextHop);

        hopSequence.push({
          hopNumber: hopNum,
          fromStar: { name: currentHopStar.name!, magnitude: currentHopStar.magnitude! },
          toStar: {
            name: bestNextHop.name!,
            magnitude: bestNextHop.magnitude!,
            ...this.formatCoordsForOutput(bestNextHop),
          },
          direction: `towards ${bearingToNextHop.cardinal} (Bearing: ${bearingToNextHop.degrees}°)`,
          angularDistanceDegrees: parseFloat(hopDistance.toFixed(1)),
        });

        currentHopStar = bestNextHop;
        currentDistanceToTarget = smallestDistToTargetForNextHop;
        visitedStarIds.add(currentHopStar.id);

        if (currentDistanceToTarget <= params.fovDegrees) {
          const bearingToTarget = calculateBearing(currentHopStar, targetEquatorial);
          return {
            ...baseResponse,
            hopSequence,
            finalStep: {
              fromStar: { name: currentHopStar.name!, magnitude: currentHopStar.magnitude! },
              message: `The target ${params.targetObjectName} should now be within your FOV, approx ${currentDistanceToTarget.toFixed(1)}° towards ${bearingToTarget.cardinal} (Bearing: ${bearingToTarget.degrees}°) from ${currentHopStar.name}.`,
            },
            status: 'Success',
            summaryMessage: `Successfully found a path with ${hopSequence.length} hop(s) to "${params.targetObjectName}".`,
          };
        }
      } else {
        // No suitable next hop found
        const bearingToTarget = calculateBearing(currentHopStar, targetEquatorial);
        return {
          ...baseResponse,
          hopSequence,
          finalStep: {
            fromStar: { name: currentHopStar.name!, magnitude: currentHopStar.magnitude! },
            message: `Pathfinding stopped. Target ${params.targetObjectName} is approx ${currentDistanceToTarget.toFixed(1)}° towards ${bearingToTarget.cardinal} (Bearing: ${bearingToTarget.degrees}°) from ${currentHopStar.name}, but no further hops could be found.`,
          },
          status: 'PathNotFound',
          summaryMessage: `Could not find a complete hopping path to "${params.targetObjectName}". Path generated with ${hopSequence.length} hop(s).`,
        };
      }
    }

    // Max hops reached
    const bearingToTarget = calculateBearing(currentHopStar, targetEquatorial);
    return {
      ...baseResponse,
      hopSequence,
      finalStep: {
        fromStar: { name: currentHopStar.name!, magnitude: currentHopStar.magnitude! },
        message: `Pathfinding stopped after maximum hops. Target ${params.targetObjectName} is approx ${currentDistanceToTarget.toFixed(1)}° towards ${bearingToTarget.cardinal} (Bearing: ${bearingToTarget.degrees}°) from ${currentHopStar.name}.`,
      },
      status: 'PathNotFound',
      summaryMessage: `Path to "${params.targetObjectName}" could not be completed within the maximum hop limit. Path generated with ${hopSequence.length} hop(s).`,
    };
  }
}

export default StarHoppingTool;

/*
Example Usage:

{
  "tool_name": "getStarHoppingPath",
  "parameters": {
    "targetObjectName": "M13",
    "fovDegrees": 5.0,
    "maxHopMagnitude": 8.0,
    "initialSearchRadiusDegrees": 25.0,
    "startStarMagnitudeThreshold": 4.0
  }
}

Expected output structure:
{
  "targetObjectName": "M13",
  "targetCoordinates": {
    "rightAscension": "16.70h",
    "declination": "36.46°",
    "altitude": "60.1°",
    "azimuth": "150.5°"
  },
  "fieldOfViewDegrees": 5.0,
  "startStar": {
    "name": "Eta Herculis",
    "magnitude": 3.48,
    "rightAscension": "16.72h",
    "declination": "38.91°"
  },
  "hopSequence": [
    {
      "hopNumber": 1,
      "fromStar": { "name": "Eta Herculis", "magnitude": 3.48 },
      "toStar": { "name": "HIP 81977", "magnitude": 5.3, "rightAscension": "16.73h", "declination": "37.22°" },
      "direction": "towards S (Bearing: 175.0°)",
      "angularDistanceDegrees": 1.7
    }
  ],
  "finalStep": {
    "fromStar": { "name": "HIP 81977", "magnitude": 5.3 },
    "message": "The target M13 should now be within your FOV, approx 0.8° towards WSW (Bearing: 240.0°) from HIP 81977."
  },
  "status": "Success",
  "summaryMessage": "Successfully found a path with 1 hop(s) to M13."
}

Status types:
- Success
- TargetNotFound
- TargetNotVisible
- NoStartingStarFound
- TargetInStartFOV
- PathNotFound
*/
