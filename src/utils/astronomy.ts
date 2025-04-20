import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as Astronomy from 'astronomy-engine';

// No custom class needed - we'll use our own calculations for fixed stars

// Define interfaces for coordinates
export interface EquatorialCoordinates {
  rightAscension: number; // in hours
  declination: number; // in degrees
  commonName?: string;
  type?: string;
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
const DSO_CATALOG: Map<string, EquatorialCoordinates> = new Map();
const STAR_CATALOG: Map<string, EquatorialCoordinates> = new Map();
const COMMON_NAMES: Map<string, string> = new Map(); // Maps common names to catalog IDs

// Fallback hardcoded catalogs in case no database files are found
const HARDCODED_STAR_CATALOG: Record<string, EquatorialCoordinates> = {
  'Sirius': { rightAscension: 6.7525, declination: -16.7161 },
  'Canopus': { rightAscension: 6.3992, declination: -52.6956 },
  'Arcturus': { rightAscension: 14.2612, declination: 19.1822 },
  'Vega': { rightAscension: 18.6157, declination: 38.7836 },
  'Capella': { rightAscension: 5.2778, declination: 45.9981 },
  'Rigel': { rightAscension: 5.2422, declination: -8.2017 },
  'Procyon': { rightAscension: 7.6550, declination: 5.2242 },
  'Betelgeuse': { rightAscension: 5.9194, declination: 7.4071 },
  'Achernar': { rightAscension: 1.6285, declination: -57.2367 },
  'Polaris': { rightAscension: 2.5301, declination: 89.2641 }
};

const HARDCODED_MESSIER_CATALOG: Record<string, EquatorialCoordinates> = {
  'M1': { rightAscension: 5.5756, declination: 22.0145 }, // Crab Nebula
  'M31': { rightAscension: 0.7122, declination: 41.2689 }, // Andromeda Galaxy
  'M42': { rightAscension: 5.5883, declination: -5.3895 }, // Orion Nebula
  'M45': { rightAscension: 3.7833, declination: 24.1167 }, // Pleiades
  'M51': { rightAscension: 13.4997, declination: 47.1950 } // Whirlpool Galaxy
};

const SOLAR_SYSTEM_OBJECTS: Record<string, boolean> = {
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
      console.warn(`DSO catalog file ${filePath} not found, using hardcoded catalog.`);
      
      // Load hardcoded data as fallback
      Object.entries(HARDCODED_MESSIER_CATALOG).forEach(([name, coords]) => {
        DSO_CATALOG.set(name.toLowerCase(), coords);
      });
      
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
              const decParts = record.Dec.split(':');
              if (decParts.length === 3) {
                const degrees = parseFloat(decParts[0]);
                const minutes = parseFloat(decParts[1]);
                const seconds = parseFloat(decParts[2]);
                if (!isNaN(degrees) && !isNaN(minutes) && !isNaN(seconds)) {
                  const sign = degrees < 0 ? -1 : 1;
                  decDegrees = Math.abs(degrees) + (minutes / 60) + (seconds / 3600);
                  decDegrees *= sign;
                }
              }
            }
            
            // Only add valid entries
            if (raHours !== undefined && decDegrees !== undefined) {
              // Add to catalog
              DSO_CATALOG.set(name.toLowerCase(), {
                rightAscension: raHours,
                declination: decDegrees,
                commonName: commonName,
                type: type
              });
              
              // Also store it by Messier number if available
              if (record.M && record.M !== '') {
                // Remove leading zeros (convert '001' to '1')
                const messierNumber = parseInt(record.M, 10).toString();
                const messierName = 'M' + messierNumber;
                DSO_CATALOG.set(messierName.toLowerCase(), {
                  rightAscension: raHours,
                  declination: decDegrees,
                  commonName: commonName,
                  type: type
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
      
      // Store the coordinates
      DSO_CATALOG.set(name.toLowerCase(), {
        rightAscension: raHours,
        declination: decDegrees,
        commonName: commonName,
        type: type
      });
      
      // Store common name for lookup if available
      if (commonName) {
        COMMON_NAMES.set(commonName.toLowerCase(), name.toLowerCase());
      }
    }
    
    console.log(`Loaded ${DSO_CATALOG.size} deep sky objects from ${filePath}`);
  } catch (error) {
    console.error(`Failed to load DSO catalog: ${error}`);
    
    // Load hardcoded data as fallback
    Object.entries(HARDCODED_MESSIER_CATALOG).forEach(([name, coords]) => {
      DSO_CATALOG.set(name.toLowerCase(), coords);
    });
  }
}

/**
 * Load stars from CSV file
 * @param filePath Path to the stars CSV file
 */
export function loadStarCatalog(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`Star catalog file ${filePath} not found, using hardcoded catalog.`);
      
      // Load hardcoded data as fallback
      Object.entries(HARDCODED_STAR_CATALOG).forEach(([name, coords]) => {
        STAR_CATALOG.set(name.toLowerCase(), coords);
      });
      
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
          
          // Store the coordinates
          STAR_CATALOG.set(name.toLowerCase(), {
            rightAscension: raHours,
            declination: decDegrees
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
      
      // Store the coordinates under the primary name
      STAR_CATALOG.set(name.toLowerCase(), {
        rightAscension: raHours,
        declination: decDegrees
      });
      
      // Also store under alternative name if available
      if (altName) {
        STAR_CATALOG.set(altName.toLowerCase(), {
          rightAscension: raHours,
          declination: decDegrees
        });
      }
    }
    
    console.log(`Loaded ${STAR_CATALOG.size} stars from ${filePath}`);
  } catch (error) {
    console.error(`Failed to load star catalog: ${error}`);
    
    // Load hardcoded data as fallback
    Object.entries(HARDCODED_STAR_CATALOG).forEach(([name, coords]) => {
      STAR_CATALOG.set(name.toLowerCase(), coords);
    });
  }
}

/**
 * Initialize catalogs from data files
 */
export function initializeCatalogs(): void {
  // Use a direct path to the data directory
  const dataDir = path.join(process.cwd(), 'data');
  console.log(`Looking for catalog data in: ${dataDir}`);
  
  // Check if data directory exists
  if (!fs.existsSync(dataDir)) {
    console.warn(`Data directory not found at ${dataDir}. Please run 'npm run fetch-catalogs' to download catalog data.`);
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Try to load Star catalog
  const starCatalogFiles = [
    'hygdata_v41.csv',
    'stars.csv',
    'bright_stars.csv',
    'sample_stars.csv'
  ];
  
  let starCatalogLoaded = false;
  for (const file of starCatalogFiles) {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading star catalog from ${file}`);
      loadStarCatalog(filePath);
      starCatalogLoaded = true;
      break;
    }
  }
  
  if (!starCatalogLoaded) {
    console.warn('No star catalog found, using hardcoded catalog');
    // Create a sample star catalog in data directory
    try {
      const sampleStarCsvContent = 
        "name,ra_hours,dec_degrees\n" +
        "Sirius,6.7525,-16.7161\n" +
        "Canopus,6.3992,-52.6956\n" +
        "Arcturus,14.2612,19.1822\n" +
        "Vega,18.6157,38.7836\n" +
        "Capella,5.2778,45.9981\n" +
        "Rigel,5.2422,-8.2017\n" +
        "Procyon,7.6550,5.2242\n" +
        "Betelgeuse,5.9194,7.4071\n" +
        "Achernar,1.6285,-57.2367\n" +
        "Polaris,2.5301,89.2641";
      
      const sampleFilePath = path.join(dataDir, 'sample_stars.csv');
      fs.writeFileSync(sampleFilePath, sampleStarCsvContent);
      console.log(`Created sample star catalog at ${sampleFilePath}`);
      loadStarCatalog(sampleFilePath);
    } catch (error) {
      console.error(`Error creating sample star catalog: ${error}`);
      // Fall back to hardcoded values if file creation fails
      Object.entries(HARDCODED_STAR_CATALOG).forEach(([name, coords]) => {
        STAR_CATALOG.set(name.toLowerCase(), coords);
      });
    }
  }
  
  // Try to load DSO catalog
  const dsoCatalogFiles = [
    'ngc.csv',
    'messier.csv',
    'dso.csv',
    'sample_dso.csv'
  ];
  
  let dsoCatalogLoaded = false;
  for (const file of dsoCatalogFiles) {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading DSO catalog from ${file}`);
      loadDSOCatalog(filePath);
      dsoCatalogLoaded = true;
      break;
    }
  }
  
  if (!dsoCatalogLoaded) {
    console.warn('No DSO catalog found, using hardcoded catalog');
    // Create a sample DSO catalog in data directory
    try {
      const sampleDsoCsvContent = 
        "name,ra_hours,dec_degrees,common_name,type\n" +
        "M1,5.5756,22.0145,Crab Nebula,Nebula\n" +
        "M31,0.7122,41.2689,Andromeda Galaxy,Galaxy\n" +
        "M42,5.5883,-5.3895,Orion Nebula,Nebula\n" +
        "M45,3.7833,24.1167,Pleiades,Open Cluster\n" +
        "M51,13.4997,47.1950,Whirlpool Galaxy,Galaxy";
      
      const sampleFilePath = path.join(dataDir, 'sample_dso.csv');
      fs.writeFileSync(sampleFilePath, sampleDsoCsvContent);
      console.log(`Created sample DSO catalog at ${sampleFilePath}`);
      loadDSOCatalog(sampleFilePath);
    } catch (error) {
      console.error(`Error creating sample DSO catalog: ${error}`);
      // Fall back to hardcoded values if file creation fails
      Object.entries(HARDCODED_MESSIER_CATALOG).forEach(([name, coords]) => {
        DSO_CATALOG.set(name.toLowerCase(), coords);
      });
    }
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
    // Improved handling for fixed objects using astronomy-engine
    
    // Check if the object never rises/sets at this latitude
    const decRad = equatorialCoords.declination * Math.PI / 180;
    const latRad = observer.latitude * Math.PI / 180;
    const cosH = -Math.tan(latRad) * Math.tan(decRad);
    
    if (Math.abs(cosH) > 1) {
      // Object never rises or sets (always above or below horizon)
      const alwaysUp = equatorialCoords.declination > 0 && observer.latitude > 0;
      const alwaysDown = equatorialCoords.declination < 0 && observer.latitude < 0;
      
      return {
        neverSets: alwaysUp,
        neverRises: alwaysDown || (!alwaysUp && Math.abs(cosH) > 1),
        isCircumpolar: Math.abs(cosH) > 1
      };
    }
    
    // Create a "star" body dynamically using Astronomy.DefineStar
    const tempStarName = "Star1"; // Use one of the predefined star slots
    
    // Register the star's coordinates for use with astronomy-engine
    Astronomy.DefineStar(
      Astronomy.Body.Star1,
      equatorialCoords.rightAscension, // RA in hours
      equatorialCoords.declination,    // Dec in degrees
      1000 // Distance in light years - not critical for rise/set calculations
    );
    
    // Now use astronomy-engine's SearchRiseSet and SearchHourAngle functions
    // to find accurate times just like with solar system objects
    
    const startTime = new Date(date);
    startTime.setHours(0, 0, 0, 0); // Start of the current day
    
    let riseTime, transitTime, setTime;
    
    try {
      // Find rise time (1 = rising)
      riseTime = Astronomy.SearchRiseSet(Astronomy.Body.Star1, astroObserver, 1, startTime, 1);
    } catch (e) {
      riseTime = null; // Object may not rise today
    }
    
    try {
      // Find transit time (hour angle = 0)
      transitTime = Astronomy.SearchHourAngle(Astronomy.Body.Star1, astroObserver, 0, startTime, 1);
    } catch (e) {
      transitTime = null;
    }
    
    try {
      // Find set time (-1 = setting)
      setTime = Astronomy.SearchRiseSet(Astronomy.Body.Star1, astroObserver, -1, startTime, 1);
    } catch (e) {
      setTime = null; // Object may not set today
    }
    
    // Convert AstroTime objects to JavaScript Date objects if needed
    const riseDate = riseTime ? new Date(riseTime.date) : null;
    const transitDate = transitTime ? transitTime.time : null;
    const setDate = setTime ? new Date(setTime.date) : null;
    
    return {
      riseTime: riseDate,
      transitTime: { time: transitDate },
      setTime: setDate,
      isFixedObject: true
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
  
  if (category === 'all' || category === 'dso') {
    // Separate Messier and other DSOs
    const messierObjects: string[] = [];
    const otherDsoObjects: string[] = [];
    
    Array.from(DSO_CATALOG.keys()).forEach(name => {
      const formattedName = name.charAt(0).toUpperCase() + name.slice(1); // Capitalize first letter
      
      if (name.startsWith('m') && /^m\d+$/i.test(name)) {
        messierObjects.push(formattedName);
      } else {
        otherDsoObjects.push(formattedName);
      }
    });
    
    if (messierObjects.length > 0) {
      result.push({
        category: 'Messier Objects',
        objects: messierObjects.sort((a, b) => {
          const numA = parseInt(a.substring(1));
          const numB = parseInt(b.substring(1));
          return numA - numB;
        })
      });
    }
    
    if (otherDsoObjects.length > 0) {
      result.push({
        category: 'Other Deep Sky Objects',
        objects: otherDsoObjects.sort()
      });
    }
  }
  
  return result;
}
