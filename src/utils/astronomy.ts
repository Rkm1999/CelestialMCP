import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { parse } from 'csv-parse/sync';
import * as Astronomy from 'astronomy-engine';
import { execSync } from 'child_process';

// No custom class needed - we'll use our own calculations for fixed stars

// Define interfaces for coordinates
export interface EquatorialCoordinates {
  rightAscension: number; // in hours
  declination: number; // in degrees
  magnitude?: number;     // Visual magnitude
  name?: string;          // Canonical name (e.g., proper name, catalog ID like 'M31', 'HIP 12345')
  commonName?: string;    // Common name, if different from 'name' (used more for DSOs)
  type?: string;          // e.g., 'Star', 'Galaxy', 'Planet'
}

export interface HorizontalCoordinates {
  altitude: number; // in degrees
  azimuth: number; // in degrees
}

export interface Observer {
  latitude: number; // in degrees, positive north
  longitude: number; // in degrees, positive east
  elevation: number; // in meters above sea level
  temperature: number; // in celsius
  pressure: number; // in hPa
}

// Catalogs to store loaded data
export const DSO_CATALOG: Map<string, EquatorialCoordinates> = new Map();
export const STAR_CATALOG: Map<string, EquatorialCoordinates> = new Map();
export const COMMON_NAMES: Map<string, string> = new Map(); // Maps common names to catalog IDs

export const SOLAR_SYSTEM_OBJECTS: Record<string, boolean> = {
  'sun': true,
  'moon': true,
  'mercury': true,
  'venus': true,
  'earth': true,
  'mars': true,
  'jupiter': true,
  'saturn': true,
  'uranus': true,
  'neptune': true,
  'pluto': true
};

/**
 * Load deep sky objects from CSV file
 * @param filePath Path to the DSO CSV file
 */
export function loadDSOCatalog(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`DSO catalog file ${filePath} not found. Data from this file will not be loaded.`);
      return;
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Special handling for OpenNGC format which uses semicolons
    if (filePath.endsWith('ngc.csv') || filePath.includes('NGC.csv')) {
      // Create a custom parser for OpenNGC format
      console.log('Using custom parser for OpenNGC format');
      try {
        const lines = fileContent.split('\n');
        const headers = lines[0].split(';');
        
        // Start from line 1 (skip header)
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue; // Skip empty lines
          
          // Split the line by semicolon
          const values = lines[i].split(';');
          const record: Record<string, string> = {};
          
          // Assign each value to its corresponding header
          for (let j = 0; j < headers.length && j < values.length; j++) {
            record[headers[j]] = values[j];
          }
          
          // Process the record
          if (record.Name) {
            // Fix object names with leading zeros (NGC0001 -> NGC1, IC0001 -> IC1)
            let name = record.Name;
            
            // Handle NGC objects with leading zeros
            if (name.startsWith('NGC')) {
              const ngcMatch = name.match(/^NGC0*([1-9]\d*)$/);
              if (ngcMatch) {
                name = 'NGC' + ngcMatch[1]; // Remove leading zeros
              }
            }
            
            // Handle IC objects with leading zeros
            if (name.startsWith('IC')) {
              const icMatch = name.match(/^IC0*([1-9]\d*)$/);
              if (icMatch) {
                name = 'IC' + icMatch[1]; // Remove leading zeros
              }
            }
            
            const type = record.Type || '';
            const commonName = record['Common names'] || '';
            
            // Parse RA (format should be HH:MM:SS.SS)
            let raHours: number | undefined;
            if (record.RA) {
              const raParts = record.RA.split(':');
              if (raParts.length === 3) {
                const hours = parseFloat(raParts[0]);
                const minutes = parseFloat(raParts[1]);
                const seconds = parseFloat(raParts[2]);
                if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
                  raHours = hours + (minutes / 60) + (seconds / 3600);
                }
              }
            }
            
            // Parse Dec (format should be +/-DD:MM:SS.S)
            let decDegrees: number | undefined;
            if (record.Dec) {
              const decStr = record.Dec.trim();
              if (decStr !== '') {
                const decParts = decStr.split(':');
                if (decParts.length === 3) {
                  const sign = decStr.startsWith('-') ? -1 : 1;
                  // Remove sign for parsing absolute degrees, handle empty parts
                  const degreesStr = decParts[0].replace(/^[+-]/, '');
                  const minutesStr = decParts[1];
                  const secondsStr = decParts[2];

                  if (degreesStr !== '' && minutesStr !== '' && secondsStr !== '') {
                      const degrees = parseFloat(degreesStr);
                      const minutes = parseFloat(minutesStr);
                      const seconds = parseFloat(secondsStr);

                      if (!isNaN(degrees) && !isNaN(minutes) && !isNaN(seconds)) {
                          decDegrees = (degrees + (minutes / 60) + (seconds / 3600)) * sign;
                      }
                  }
                }
              }
            }
            
            // Only add valid entries
            if (raHours !== undefined && decDegrees !== undefined) {
              let magnitude: number | undefined;
              const vMagStr = record['V-Mag'];
              const bMagStr = record['B-Mag'];

              if (vMagStr && vMagStr.trim() !== '') {
                const magVal = parseFloat(vMagStr);
                if (!isNaN(magVal)) {
                  magnitude = magVal;
                }
              } else if (bMagStr && bMagStr.trim() !== '') { // Fallback to B-Mag if V-Mag is not available
                const magVal = parseFloat(bMagStr);
                if (!isNaN(magVal)) {
                  magnitude = magVal;
                }
              }

              DSO_CATALOG.set(name.toLowerCase(), {
                name: name, // Store original name
                rightAscension: raHours,
                declination: decDegrees,
                commonName: commonName,
                type: type,
                magnitude: magnitude
              });
              
              // Also store it by Messier number if available
              if (record.M && record.M !== '') {
                const messierNumber = parseInt(record.M, 10).toString();
                const messierName = 'M' + messierNumber;
                DSO_CATALOG.set(messierName.toLowerCase(), {
                  rightAscension: raHours,
                  declination: decDegrees,
                  commonName: commonName,
                  type: type,
                  magnitude: magnitude,
                  name: messierName // Store Messier name
                });
              }
              
              // Store common name for lookup if available
              if (commonName) {
                COMMON_NAMES.set(commonName.toLowerCase(), name.toLowerCase());
              }
            }
          }
        }
        
        console.log(`Processed ${DSO_CATALOG.size} objects from OpenNGC catalog`);
        return;
      } catch (error) {
        console.error('Error parsing OpenNGC format:', error);
      }
    }
    
    // For other files, detect if the file uses semicolons as separators
    const isSemicolonSeparated = fileContent.indexOf(';') !== -1 && fileContent.indexOf(',') === -1;
    
    // Parse based on separator
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: isSemicolonSeparated ? ';' : ','
    }) as any[];
    
    for (const record of records) {
      // Extract name and common name if available
      const name = record.name || record.Name || record.id || record.ID || '';
      const commonName = record.common_name || record.commonName || record['common name'] || '';
      const type = record.type || record.Type || '';
      
      // Extract RA and Dec in different possible formats
      let raHours = undefined;
      let decDegrees = undefined;
      
      // Handle different RA/Dec formats
      if (record.ra_hours !== undefined) {
        raHours = parseFloat(record.ra_hours);
      } else if (record.RA !== undefined) {
        // Convert RA from degrees to hours if needed
        const ra = parseFloat(record.RA);
        raHours = ra / 15; // 15 degrees = 1 hour
      }
      
      if (record.dec_degrees !== undefined) {
        decDegrees = parseFloat(record.dec_degrees);
      } else if (record.Dec !== undefined) {
        decDegrees = parseFloat(record.Dec);
      }
      
      // Skip if we couldn't parse the coordinates
      if (!name || raHours === undefined || decDegrees === undefined || isNaN(raHours) || isNaN(decDegrees)) {
        continue;
      }

      let magnitude: number | undefined = undefined;
      const vMagStr = record['V-Mag'] || record.VMAG || record.vmag;
      const bMagStr = record['B-Mag'] || record.BMAG || record.bmag;
      const magStr = record.magnitude || record.Magnitude || record.MAG || record.mag;

      if (vMagStr !== undefined && String(vMagStr).trim() !== '') {
        const magVal = parseFloat(String(vMagStr));
        if (!isNaN(magVal)) {
          magnitude = magVal;
        }
      } else if (bMagStr !== undefined && String(bMagStr).trim() !== '') {
        const magVal = parseFloat(String(bMagStr));
        if (!isNaN(magVal)) {
          magnitude = magVal;
        }
      } else if (magStr !== undefined && String(magStr).trim() !== '') {
        const magVal = parseFloat(String(magStr));
        if (!isNaN(magVal)) {
          magnitude = magVal;
        }
      }
      // Store the coordinates
      DSO_CATALOG.set(name.toLowerCase(), {
        name: name,
        rightAscension: raHours,
        declination: decDegrees,
        commonName: commonName,
        type: type,
        magnitude: magnitude
      });
      
      // Store common name for lookup if available
      if (commonName) {
        COMMON_NAMES.set(commonName.toLowerCase(), name.toLowerCase());
      }
    }
    
    console.log(`Loaded ${DSO_CATALOG.size} deep sky objects from ${filePath}`);
  } catch (error) {
    console.error(`Failed to load DSO catalog from ${filePath}: ${error}. Data from this file will not be loaded.`);
  }
}

/**
 * Load stars from CSV file
 * @param filePath Path to the stars CSV file
 */
export function loadStarCatalog(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`Star catalog file ${filePath} not found. Data from this file will not be loaded.`);
      return;
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Special handling for HYG database
    if (filePath.includes('hygdata_v')) {
      console.log('Using specific parser for HYG database format');
      
      // Add options to limit fields and improve performance
      const parseOptions = {
        columns: true,
        skip_empty_lines: true,
        delimiter: ',', // HYG uses commas
        // Skip rows that don't meet our criteria using the on_record hook
        on_record: (record: any, {lines}: {lines: number}) => {
          // Only keep stars that:
          // 1. Have a proper name, or
          // 2. Are bright enough to be seen with the naked eye (mag < 6.0), or
          // 3. Have a Bayer/Flamsteed designation
          const hasName = record.proper || record.bf;
          const isBright = record.mag !== undefined && parseFloat(record.mag) < 6.0;
          
          if (hasName || isBright) {
            return record;
          }
          return null; // Skip this record
        }
      };
      
      try {
        const records = parse(fileContent, parseOptions) as any[];
        console.log(`Parsed ${records.length} HYG database records`);
        
        for (const record of records) {
          // Get star name - prefer proper name, then Bayer/Flamsteed designation, then HD number
          let name = '';
          
          if (record.proper && record.proper.trim()) {
            name = record.proper.trim();
          } else if (record.bf && record.bf.trim()) {
            name = record.bf.trim();
          } else if (record.hip && record.hip.trim()) {
            name = 'HIP ' + record.hip.trim();
          } else if (record.hd && record.hd.trim()) {
            name = 'HD ' + record.hd.trim();
          } else if (record.mag !== undefined && parseFloat(record.mag) < 6.0) {
            // For bright stars without names, use magnitude and constellation
            name = `Star mag ${parseFloat(record.mag).toFixed(1)}`;
            if (record.con && record.con.trim()) {
              name += ` in ${record.con.trim()}`;
            }
          }
          
          if (!name) continue;
          
          // Get RA (in hours) and Dec (in degrees)
          let raHours: number | undefined;
          let decDegrees: number | undefined;
          
          if (record.ra !== undefined && record.ra !== null && record.ra !== '') {
            raHours = parseFloat(record.ra);
          }
          
          if (record.dec !== undefined && record.dec !== null && record.dec !== '') {
            decDegrees = parseFloat(record.dec);
          }
          
          // Skip if we couldn't extract coordinates
          if (raHours === undefined || decDegrees === undefined || isNaN(raHours) || isNaN(decDegrees)) {
            continue;
          }
          
          // Parse magnitude
          let magnitude: number | undefined;
          if (record.mag !== undefined && record.mag !== null && String(record.mag).trim() !== '') {
            const magVal = parseFloat(String(record.mag));
            if (!isNaN(magVal)) {
              magnitude = magVal;
            }
          }

          // Store the coordinates
          STAR_CATALOG.set(name.toLowerCase(), {
            name: name,
            rightAscension: raHours,
            declination: decDegrees,
            magnitude: magnitude, // Add parsed magnitude
            type: 'Star'
          });
        }
        
        console.log(`Loaded ${STAR_CATALOG.size} stars from HYG database`);
        return;
      } catch (error) {
        console.error(`Error parsing HYG database: ${error}`);
        // Fall through to generic parser
      }
    }
    
    // For non-HYG files, detect if the file uses semicolons as separators
    const isSemicolonSeparated = fileContent.indexOf(';') !== -1 && fileContent.indexOf(',') === -1;
    
    // Parse based on separator
    console.log("Parsing standard star catalog...");
    
    // Add options for generic star catalogs
    const parseOptions = {
      columns: true,
      skip_empty_lines: true,
      delimiter: isSemicolonSeparated ? ';' : ','
    };
    
    const records = parse(fileContent, parseOptions) as any[];
    
    for (const record of records) {
      // Extract name data
      let name = record.name || record.proper || record.ProperName || '';
      let altName = record.alt_name || record.BayerFlamsteed || '';
      
      // Handle RA/Dec in different formats
      let raHours: number | undefined;
      let decDegrees: number | undefined;
      
      if (record.ra_hours !== undefined) {
        raHours = parseFloat(record.ra_hours);
      } else if (record.RA !== undefined) {
        // Convert RA from degrees to hours if needed
        const ra = parseFloat(record.RA);
        raHours = ra / 15; // 15 degrees = 1 hour
      }
      
      if (record.dec_degrees !== undefined) {
        decDegrees = parseFloat(record.dec_degrees);
      } else if (record.Dec !== undefined) {
        decDegrees = parseFloat(record.Dec);
      }
      
      // Skip if we couldn't extract needed information
      if (!name || raHours === undefined || decDegrees === undefined || isNaN(raHours) || isNaN(decDegrees)) {
        continue;
      }

      let magnitude: number | undefined;
      if (record.mag !== undefined && record.mag !== null && record.mag !== '') {
        const magVal = parseFloat(record.mag);
        if (!isNaN(magVal)) {
          magnitude = magVal;
        }
      }
      
      // Store the coordinates under the primary name
      STAR_CATALOG.set(name.toLowerCase(), {
        name: name,
        rightAscension: raHours,
        declination: decDegrees,
        magnitude: magnitude,
        type: 'Star'
      });
      
      // Also store under alternative name if available
      if (altName) {
        STAR_CATALOG.set(altName.toLowerCase(), {
          name: name, // Use primary name for consistency, altName is just for lookup
          rightAscension: raHours,
          declination: decDegrees,
          magnitude: magnitude,
          type: 'Star'
        });
      }
    }
    
    console.log(`Loaded ${STAR_CATALOG.size} stars from ${filePath}`);
  } catch (error) {
    console.error(`Failed to load star catalog from ${filePath}: ${error}. Data from this file will not be loaded.`);
  }
}

/**
 * Initialize catalogs from data files
 */
export function initializeCatalogs(): void {
  // Use a direct path to the data directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dataDir = path.resolve(__dirname, '../../data');
  const projectRoot = path.resolve(__dirname, '../../..'); // Project root for running script
  console.log(`Looking for catalog data in: ${dataDir}`);
  
  // Check if data directory exists
  if (!fs.existsSync(dataDir)) {
    console.warn(`Data directory not found at ${dataDir}. It will be created. The application will attempt to download catalogs.`);
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // --- Star Catalog ---
  let starCatalogLoaded = false;
  const primaryStarFiles = [
    'hygdata_v41.csv',
    'stars.csv',
    'bright_stars.csv'
  ];
  // sample_stars.csv is in the repo, so check for it as a last resort among existing files.
  const allStarFilesToCheck = [...primaryStarFiles, 'sample_stars.csv']; 

  for (const file of allStarFilesToCheck) {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading star catalog from ${filePath}`);
      loadStarCatalog(filePath);
      starCatalogLoaded = true;
      break;
    }
  }

  if (!starCatalogLoaded) {
    console.warn('No star catalog file was successfully loaded, even after download attempt. Star catalog will be empty or incomplete.');
    // STAR_CATALOG will remain as it is (likely empty).
  }

  // --- DSO Catalog ---
  let dsoCatalogLoaded = false;
  const primaryDsoFiles = [
    'ngc.csv',
    'messier.csv',
    'dso.csv'
  ];
  // sample_dso.csv is in the repo, so check for it as a last resort among existing files.
  const allDsoFilesToCheck = [...primaryDsoFiles, 'sample_dso.csv'];

  for (const file of allDsoFilesToCheck) {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading DSO catalog from ${filePath}`);
      loadDSOCatalog(filePath);
      dsoCatalogLoaded = true;
      break;
    }
  }

  if (!dsoCatalogLoaded) {
    console.warn('No DSO catalog file was successfully loaded, even after download attempt. DSO catalog will be empty or incomplete.');
    // DSO_CATALOG will remain as it is (likely empty).
  }
}

// Initialize catalogs on module import
initializeCatalogs();

/**
 * Calculate solar system object positions using astronomy-engine
 */
function getSolarSystemCoordinates(name: string, date: Date): EquatorialCoordinates {
  // Create a default observer for equatorial coordinates (geocentric)
  const defaultObserver = new Astronomy.Observer(0, 0, 0);
  
  // Handle special case for sun and moon
  if (name === 'sun') {
    const equ = Astronomy.Equator(Astronomy.Body.Sun, date, defaultObserver, false, true);
    return {
      rightAscension: equ.ra,
      declination: equ.dec
    };
  } else if (name === 'moon') {
    const equ = Astronomy.Equator(Astronomy.Body.Moon, date, defaultObserver, false, true);
    return {
      rightAscension: equ.ra,
      declination: equ.dec
    };
  }

  // Convert name to Body enum for planets
  // Capitalize first letter to match Body enum format
  const bodyName = name.charAt(0).toUpperCase() + name.slice(1);
  let body;
  
  try {
    // Use bracket notation with type checking
    if (bodyName in Astronomy.Body) {
      body = Astronomy.Body[bodyName as keyof typeof Astronomy.Body];
    } else {
      throw new Error(`Unknown solar system object: ${name}`);
    }
  } catch (e) {
    throw new Error(`Unknown solar system object: ${name}`);
  }
  
  // Get equatorial coordinates using astronomy-engine
  const equ = Astronomy.Equator(body, date, defaultObserver, false, true);
  
  return {
    rightAscension: equ.ra,
    declination: equ.dec
  };
}

/**
 * Get equatorial coordinates for a celestial object at a specific time
 * @param objectName Name of the celestial object
 * @param date Date and time of observation
 * @returns Equatorial coordinates (right ascension and declination)
 */
export async function getEquatorialCoordinates(objectName: string, date: Date): Promise<EquatorialCoordinates> {
  // Normalize object name to lowercase for case-insensitive matching
  const normalizedName = objectName.toLowerCase();
  
  // Handle solar system objects
  if (SOLAR_SYSTEM_OBJECTS[normalizedName]) {
    return getSolarSystemCoordinates(normalizedName, date);
  }
  
  // Check if it's a common name (like "Andromeda Galaxy" instead of "M31")
  if (COMMON_NAMES.has(normalizedName)) {
    const catalogName = COMMON_NAMES.get(normalizedName)!;
    const dsoObject = DSO_CATALOG.get(catalogName);
    if (dsoObject) {
      return dsoObject;
    }
  }
  
  // Check for direct matches in catalogs
  if (STAR_CATALOG.has(normalizedName)) {
    return STAR_CATALOG.get(normalizedName)!;
  }
  
  if (DSO_CATALOG.has(normalizedName)) {
    return DSO_CATALOG.get(normalizedName)!;
  }
  
  // If we reach here, the object is not recognized
  throw new Error(`Unknown celestial object: ${objectName}. Try running 'npm run fetch-catalogs' to download more complete star and deep sky object databases.`);
}

/**
 * Convert equatorial coordinates to horizontal (altitude-azimuth) coordinates using astronomy-engine
 */
export function convertToAltAz(
  coords: EquatorialCoordinates,
  observer: Observer,
  date: Date
): HorizontalCoordinates {
  // We already have an astroObserver defined above
  
  // Determine refraction mode - must be one of the preset strings
  // Available options are: 'none', 'normal', 'jplhor'
  // For simplicity, we'll just use 'normal' which includes standard refraction
  const refraction = 'normal';
  
  // Convert equatorial to horizontal coordinates
  const astroObserver = new Astronomy.Observer(
    observer.latitude,
    observer.longitude,
    observer.elevation
  );
  
  const hor = Astronomy.Horizon(
    date,
    astroObserver,
    coords.rightAscension,
    coords.declination,
    refraction
  );
  
  return {
    altitude: hor.altitude,
    azimuth: hor.azimuth
  };
}

/**
 * List all celestial objects from catalogs
 * @param category Optional category filter ('stars', 'planets', 'dso', or 'all')
 * @returns Array of objects grouped by category
 */
/**
 * Get additional information about a celestial object
 */
export function getObjectDetails(objectName: string, date: Date, observer: Observer): any {
  const normalizedName = objectName.toLowerCase();
  
  // Create astronomy-engine Observer reference for this function
  let astroObserver = new Astronomy.Observer(
    observer.latitude,
    observer.longitude,
    observer.elevation
  );
  
  // Check if this is a solar system object
  const isSolarSystemObject = SOLAR_SYSTEM_OBJECTS[normalizedName] ? true : false;
  
  // If not a solar system object, we still want to try calculating rise/set times
  // First, we need to get the equatorial coordinates
  let equatorialCoords: EquatorialCoordinates | null = null;
  
  // Need to check star and DSO catalogs for this object
  if (STAR_CATALOG.has(normalizedName)) {
    equatorialCoords = STAR_CATALOG.get(normalizedName)!;
  } else if (DSO_CATALOG.has(normalizedName)) {
    equatorialCoords = DSO_CATALOG.get(normalizedName)!;
  } else if (COMMON_NAMES.has(normalizedName)) {
    const catalogName = COMMON_NAMES.get(normalizedName)!;
    if (DSO_CATALOG.has(catalogName)) {
      equatorialCoords = DSO_CATALOG.get(catalogName)!;
    }
  }
  
  // If we found coordinates for a star or DSO, calculate rise/set times
  if (equatorialCoords && !isSolarSystemObject) {
    // Create a "star" body dynamically using Astronomy.DefineStar
    const tempStarName = "Star1"; // Use one of the predefined star slots
    
    // Register the star's coordinates for use with astronomy-engine
    Astronomy.DefineStar(
      Astronomy.Body.Star1,
      equatorialCoords.rightAscension, // RA in hours
      equatorialCoords.declination,    // Dec in degrees
      1000 // Distance in light years - not critical for rise/set calculations
    );
    
    const startTime = new Date(date);
    startTime.setHours(0, 0, 0, 0); // Start of the current day
    
    let riseAstroTime, transitAstroEvent, setAstroTime, lowerCulminationEvent;
    
    try { riseAstroTime = Astronomy.SearchRiseSet(Astronomy.Body.Star1, astroObserver, 1, startTime, 1); } catch (e) { riseAstroTime = null; }
    try { transitAstroEvent = Astronomy.SearchHourAngle(Astronomy.Body.Star1, astroObserver, 0, startTime, 1); } catch (e) { transitAstroEvent = null; } // Upper culmination
    try { setAstroTime = Astronomy.SearchRiseSet(Astronomy.Body.Star1, astroObserver, -1, startTime, 1); } catch (e) { setAstroTime = null; }
    try { lowerCulminationEvent = Astronomy.SearchHourAngle(Astronomy.Body.Star1, astroObserver, 12, startTime, 1); } catch (e) { lowerCulminationEvent = null; } // Lower culmination

    // Rise/Set times are AstroTime objects from astronomy-engine, or null.
    // The .date property of AstroTime is a JS Date.
    // For fixed objects, we convert to JS Date directly here for rise/set.
    const riseDate = riseAstroTime ? new Date(riseAstroTime.date) : null;
    const setDate = setAstroTime ? new Date(setAstroTime.date) : null;
    // For transit, transitAstroEvent is { time: AstroTime, hor: HorizontalCoordinates }
    // We pass transitAstroEvent.time (which is AstroTime) to the tool.

    let isCircumpolar = false;
    let alwaysAboveHorizon = false;
    let alwaysBelowHorizon = false;

    // Check for circumpolar status: |Dec| > 90 - |Lat|
    const isPotentiallyCircumpolar = Math.abs(equatorialCoords.declination) > (90 - Math.abs(observer.latitude));

    if (isPotentiallyCircumpolar) {
        isCircumpolar = true;
        // If it's circumpolar, check culminations to determine if always visible/invisible.
        if (lowerCulminationEvent && lowerCulminationEvent.hor && lowerCulminationEvent.hor.altitude > 0) {
            alwaysAboveHorizon = true; // Min altitude (lower culmination) is above horizon.
        }
        if (transitAstroEvent && transitAstroEvent.hor && transitAstroEvent.hor.altitude < 0) {
            alwaysBelowHorizon = true; // Max altitude (upper culmination) is below horizon.
        }

        // Fallback if culmination data is incomplete but rise/set are null
        if (!alwaysAboveHorizon && !alwaysBelowHorizon) { // If not determined by culminations yet
            if (riseDate === null && setDate === null && transitAstroEvent && transitAstroEvent.hor) {
                if (transitAstroEvent.hor.altitude > 0) {
                    alwaysAboveHorizon = true; 
                } else {
                    alwaysBelowHorizon = true;
                }
            }
        }
    }

    return {
      riseTime: riseDate,
      transitTime: transitAstroEvent ? { time: transitAstroEvent.time, hor: transitAstroEvent.hor } : null,
      setTime: setDate,
      isFixedObject: true,
      isCircumpolar: isCircumpolar,
      alwaysAboveHorizon: alwaysAboveHorizon,
      alwaysBelowHorizon: alwaysBelowHorizon
    };
  }
  
  // Only continue with solar system object handling if this is a solar system object
  if (!isSolarSystemObject) {
    return null;
  }
  
  // We already created the astroObserver variable above, so just update it
  astroObserver = new Astronomy.Observer(
    observer.latitude,
    observer.longitude,
    observer.elevation
  );
  
  // Convert name to Body enum
  const bodyName = normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1);
  let body;
  
  if (normalizedName === 'sun') {
    body = Astronomy.Body.Sun;
  } else if (normalizedName === 'moon') {
    body = Astronomy.Body.Moon;
  } else if (bodyName in Astronomy.Body) {
    body = Astronomy.Body[bodyName as keyof typeof Astronomy.Body];
  } else {
    return null; // Unknown body
  }
  
  if (!body) {
    return null;
  }
  
  // Find rise, set, and culmination times
  const now = date;
  const startTime = new Date(now);
  startTime.setHours(0, 0, 0, 0);
  
  let riseTime, transitTime, setTime;
  
  try {
    riseTime = Astronomy.SearchRiseSet(body, astroObserver, 1, startTime, 1);
  } catch (e) {
    riseTime = null; // Object may not rise
  }
  
  try {
    transitTime = Astronomy.SearchHourAngle(body, astroObserver, 0, startTime, 1);
  } catch (e) {
    transitTime = null;
  }
  
  try {
    setTime = Astronomy.SearchRiseSet(body, astroObserver, -1, startTime, 1);
  } catch (e) {
    setTime = null; // Object may not set
  }
  
  // Get distance (for planets, moon)
  let distance = null;
  if (body !== Astronomy.Body.Sun && body !== Astronomy.Body.Earth) {
    try {
      // For the moon, use a different approach
      if (body === Astronomy.Body.Moon) {
        const moonVec = Astronomy.GeoMoon(date);
        distance = {
          au: moonVec.Length(),
          km: moonVec.Length() * Astronomy.KM_PER_AU
        };
      } else {
        // For planets - calculate distance using position vectors
        const bodyPos = Astronomy.HelioVector(body, date);
        const earthPos = Astronomy.HelioVector(Astronomy.Body.Earth, date);
        // Calculate the difference vector
        const dx = bodyPos.x - earthPos.x;
        const dy = bodyPos.y - earthPos.y;
        const dz = bodyPos.z - earthPos.z;
        // Calculate the distance
        const distAu = Math.sqrt(dx*dx + dy*dy + dz*dz);
        distance = {
          au: distAu,
          km: distAu * Astronomy.KM_PER_AU
        };
      }
    } catch (e) {
      // Some objects might not have distance calculation
    }
  }
  
  // Get phase information (for moon and planets)
  let phaseInfo = null;
  if (body !== Astronomy.Body.Sun && body !== Astronomy.Body.Earth) {
    try {
      const illumination = Astronomy.Illumination(body, date);
      phaseInfo = {
        phaseAngle: illumination.phase_angle,
        phasePercent: illumination.phase_fraction * 100,
        isWaxing: illumination.phase_angle < 180
      };
    } catch (e) {
      // Some objects might not have phase calculation
    }
  }
  
  // For the moon, get next phase times
  let moonPhases = null;
  if (body === Astronomy.Body.Moon) {
    moonPhases = {
      nextNewMoon: Astronomy.SearchMoonPhase(0, date, 40),
      nextFirstQuarter: Astronomy.SearchMoonPhase(90, date, 40),
      nextFullMoon: Astronomy.SearchMoonPhase(180, date, 40),
      nextLastQuarter: Astronomy.SearchMoonPhase(270, date, 40)
    };
  }
  
  return {
    riseTime,
    transitTime,
    setTime,
    distance,
    phaseInfo,
    moonPhases
  };
}

/**
 * Star hopping utility functions
 */
export function findNearbyStars(
  targetCoords: EquatorialCoordinates,
  maxDistance: number, // in degrees
  date: Date
): { name: string, coords: EquatorialCoordinates }[] {
  const nearbyStars: { name: string, coords: EquatorialCoordinates }[] = [];
  
  // Convert max distance from degrees to radians
  const maxDistRad = maxDistance * (Math.PI / 180);
  
  // Search through star catalog
  for (const [name, coords] of STAR_CATALOG.entries()) {
    // Skip the target star itself
    if (name.toLowerCase() === targetCoords.name?.toLowerCase()) {
      continue;
    }
    
    // Calculate angular distance using spherical law of cosines
    const sinDec1 = Math.sin(targetCoords.declination * (Math.PI / 180));
    const cosDec1 = Math.cos(targetCoords.declination * (Math.PI / 180));
    const sinDec2 = Math.sin(coords.declination * (Math.PI / 180));
    const cosDec2 = Math.cos(coords.declination * (Math.PI / 180));
    const deltaRA = (coords.rightAscension - targetCoords.rightAscension) * (Math.PI / 180);
    
    // Angular distance in radians
    const angularDistance = Math.acos(sinDec1 * sinDec2 + cosDec1 * cosDec2 * Math.cos(deltaRA));
    
    // If the distance is within the maxDistance, add to results
    if (angularDistance <= maxDistRad) {
      nearbyStars.push({ name, coords });
    }
  }
  
  return nearbyStars;
}

/**
 * List all celestial objects from catalogs
 * @param category Optional category filter ('stars', 'planets', 'dso', or 'all')
 * @returns Array of objects grouped by category
 */
export function listCelestialObjects(category: string = 'all'): { category: string, objects: string[] }[] {
  const result: { category: string, objects: string[] }[] = [];
  
  if (category === 'all' || category === 'planets') {
    result.push({
      category: 'Solar System Objects',
      objects: Object.keys(SOLAR_SYSTEM_OBJECTS).map(name => 
        name.charAt(0).toUpperCase() + name.slice(1) // Capitalize first letter
      )
    });
  }
  
  if (category === 'all' || category === 'stars') {
    // Get unique star names and sort them
    const starNames = Array.from(new Set(
      Array.from(STAR_CATALOG.keys()).map(name => 
        name.charAt(0).toUpperCase() + name.slice(1) // Capitalize first letter
      )
    )).sort();
    
    result.push({
      category: 'Stars',
      objects: starNames
    });
  }
  
  if (category === 'all' || category === 'dso' ||
      category === 'messier' || category === 'ic' || category === 'ngc') {

    const messierObjects: string[] = [];
    const icObjects: string[] = [];
    const ngcObjects: string[] = [];
    const otherDsoObjects: string[] = [];

    Array.from(DSO_CATALOG.keys()).forEach(name => {
      const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

      if (name.startsWith('m') && /^m\d+$/i.test(name)) {
        messierObjects.push(formattedName);
      } else if (name.startsWith('ic') && /^ic\d+$/i.test(name)) {
        icObjects.push(formattedName);
      } else if (name.startsWith('ngc') && /^ngc\d+$/i.test(name)) {
        ngcObjects.push(formattedName);
      } else {
        otherDsoObjects.push(formattedName);
      }
    });

    if ((category === 'all' || category.toLowerCase() === 'messier' || category.toLowerCase() === 'dso') && messierObjects.length > 0) {
      result.push({
        category: 'Messier Objects',
        objects: messierObjects.sort((a, b) => {
          const numA = parseInt(a.substring(1));
          const numB = parseInt(b.substring(1));
          return numA - numB;
        })
      });
    }

    if ((category === 'all' || category.toLowerCase() === 'ic' || category.toLowerCase() === 'dso') && icObjects.length > 0) {
      result.push({
        category: 'IC Objects',
        objects: icObjects.sort((a, b) => {
          const numA = parseInt(a.substring(2));
          const numB = parseInt(b.substring(2));
          return numA - numB;
        })
      });
    }

    if ((category === 'all' || category.toLowerCase() === 'ngc' || category.toLowerCase() === 'dso') && ngcObjects.length > 0) {
      result.push({
        category: 'NGC Objects',
        objects: ngcObjects.sort((a, b) => {
          const numA = parseInt(a.substring(3));
          const numB = parseInt(b.substring(3));
          return numA - numB;
        })
      });
    }
    
    if ((category === 'all' || category.toLowerCase() === 'dso') && otherDsoObjects.length > 0) {
        result.push({
            category: 'Other Deep Sky Objects',
            objects: otherDsoObjects.sort()
        });
    }
  }
  
  return result;
}

// Corrected export of calculateAngularSeparation
export function calculateAngularSeparation(
  coords1: { rightAscension: number; declination: number },
  coords2: { rightAscension: number; declination: number }
): number {
  // Use the spherical law of cosines for angular separation
  const ra1Rad = coords1.rightAscension * 15 * Math.PI / 180;
  const ra2Rad = coords2.rightAscension * 15 * Math.PI / 180;
  const dec1Rad = coords1.declination * Math.PI / 180;
  const dec2Rad = coords2.declination * Math.PI / 180;

  const cosDeltaSigma =
    Math.sin(dec1Rad) * Math.sin(dec2Rad) +
    Math.cos(dec1Rad) * Math.cos(dec2Rad) * Math.cos(ra1Rad - ra2Rad);

  // Clamp the value to [-1, 1] to avoid NaN from Math.acos due to floating point inaccuracies
  const clampedCosDeltaSigma = Math.max(-1, Math.min(1, cosDeltaSigma));

  return Math.acos(clampedCosDeltaSigma) * (180 / Math.PI);
}

// Corrected export of calculateBearing
export function calculateBearing(
  coords1: { rightAscension: number; declination: number },
  coords2: { rightAscension: number; declination: number }
): { degrees: number; cardinal: string } {
  // Compute position angle (bearing) from coords1 to coords2
  const ra1Rad = coords1.rightAscension * 15 * Math.PI / 180;
  const ra2Rad = coords2.rightAscension * 15 * Math.PI / 180;
  const dec1Rad = coords1.declination * Math.PI / 180;
  const dec2Rad = coords2.declination * Math.PI / 180;

  // Formula for position angle (bearing) from coords1 to coords2
  const y = Math.sin(ra2Rad - ra1Rad);
  const x = Math.cos(dec1Rad) * Math.tan(dec2Rad) - Math.sin(dec1Rad) * Math.cos(ra2Rad - ra1Rad);
  let angleDegrees = Math.atan2(y, x) * (180 / Math.PI);
  if (angleDegrees < 0) angleDegrees += 360;

  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  // Ensure positive index before modulo, and handle potential floating point inaccuracies for rounding.
  // Adding 0.001 before rounding helps stabilize index selection for angles very close to a boundary (e.g. 359.99 deg)
  const index = Math.round((angleDegrees / 22.5) + 0.001) % 16;
  const cardinal = directions[index];

  return { degrees: parseFloat(angleDegrees.toFixed(1)), cardinal };
}
