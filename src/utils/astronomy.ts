import * as Astronomy from 'astronomy-engine';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

/**
 * Interface for equatorial coordinates
 */
export interface EquatorialCoordinates {
  rightAscension: number; // in hours
  declination: number; // in degrees
}

/**
 * Interface for horizontal (altitude-azimuth) coordinates
 */
export interface HorizontalCoordinates {
  altitude: number; // in degrees
  azimuth: number; // in degrees
}

/**
 * Interface for observer information
 */
export interface Observer {
  latitude: number; // in degrees, positive north
  longitude: number; // in degrees, positive east
  elevation: number; // in meters above sea level
  temperature: number; // in celsius
  pressure: number; // in hPa
}

/**
 * Interface for a deep sky object
 */
interface DSOData {
  name: string;
  common_name?: string;
  type?: string;
  ra_hours: number;
  dec_degrees: number;
  magnitude?: number;
}

/**
 * Interface for a star
 */
interface StarData {
  name: string;
  alt_name?: string;
  ra_hours: number;
  dec_degrees: number;
  magnitude?: number;
  constellation?: string;
}

// Catalogs to store loaded data
const DSO_CATALOG: Map<string, EquatorialCoordinates & { commonName?: string; type?: string }> = new Map();
const STAR_CATALOG: Map<string, EquatorialCoordinates & { altName?: string; constellation?: string }> = new Map();
const COMMON_NAMES: Map<string, string> = new Map(); // Maps common names to catalog IDs

// Legacy hardcoded catalogs (keep for backup)
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
  'Polaris': { rightAscension: 2.5301, declination: 89.2641 },
  'Altair': { rightAscension: 19.8463, declination: 8.8683 },
  'Aldebaran': { rightAscension: 4.5986, declination: 16.5090 },
  'Antares': { rightAscension: 16.4901, declination: -26.4319 },
  'Spica': { rightAscension: 13.4199, declination: -11.1613 },
  'Pollux': { rightAscension: 7.7553, declination: 28.0262 },
  'Deneb': { rightAscension: 20.6905, declination: 45.2803 },
  'Regulus': { rightAscension: 10.1395, declination: 11.9672 },
  'Fomalhaut': { rightAscension: 22.9608, declination: -29.6222 },
  'Castor': { rightAscension: 7.5767, declination: 31.8882 },
  'Gamma Crucis': { rightAscension: 12.5194, declination: -57.1132 }
};

const HARDCODED_MESSIER_CATALOG: Record<string, EquatorialCoordinates> = {
  'M1': { rightAscension: 5.5756, declination: 22.0145 }, // Crab Nebula
  'M8': { rightAscension: 18.0636, declination: -24.3800 }, // Lagoon Nebula
  'M13': { rightAscension: 16.6958, declination: 36.4613 }, // Hercules Globular Cluster
  'M31': { rightAscension: 0.7122, declination: 41.2689 }, // Andromeda Galaxy
  'M42': { rightAscension: 5.5883, declination: -5.3895 }, // Orion Nebula
  'M45': { rightAscension: 3.7833, declination: 24.1167 }, // Pleiades
  'M51': { rightAscension: 13.4997, declination: 47.1950 }, // Whirlpool Galaxy
  'M57': { rightAscension: 18.8933, declination: 33.0283 }, // Ring Nebula
  'M81': { rightAscension: 9.9256, declination: 69.0652 }, // Bode's Galaxy
  'M82': { rightAscension: 9.9333, declination: 69.6797 }, // Cigar Galaxy
  'M87': { rightAscension: 12.3987, declination: 12.3906 }, // Virgo A
  'M104': { rightAscension: 12.6669, declination: -11.6237 } // Sombrero Galaxy
};

const HARDCODED_NGC_CATALOG: Record<string, EquatorialCoordinates> = {
  'NGC7000': { rightAscension: 20.9850, declination: 44.3333 }, // North America Nebula
  'NGC6960': { rightAscension: 20.7650, declination: 30.7150 }, // Veil Nebula
  'NGC5139': { rightAscension: 13.4467, declination: -47.4790 }, // Omega Centauri
  'NGC4565': { rightAscension: 12.5364, declination: 25.9876 }, // Needle Galaxy
  'NGC6992': { rightAscension: 20.9149, declination: 31.7186 } // Eastern Veil Nebula
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
        DSO_CATALOG.set(name, coords);
      });
      
      Object.entries(HARDCODED_NGC_CATALOG).forEach(([name, coords]) => {
        DSO_CATALOG.set(name, coords);
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
        const records = [];
        
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
              DSO_CATALOG.set(name, {
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
                DSO_CATALOG.set(messierName, {
                  rightAscension: raHours,
                  declination: decDegrees,
                  commonName: commonName,
                  type: type
                });
              }
              
              // Store common name for lookup if available
              if (commonName) {
                COMMON_NAMES.set(commonName.toLowerCase(), name);
              }
            }
          }
        }
        
        console.log(`Processed ${DSO_CATALOG.size} objects from OpenNGC catalog`);
        return;
      } catch (error) {
        console.error('Error parsing OpenNGC format:', error);
        // Fall back to standard parsing
      }
    }
    
    // For other files, detect if the file uses semicolons as separators
    const isSemicolonSeparated = fileContent.indexOf(';') !== -1 && fileContent.indexOf(',') === -1;
    
    // Parse based on separator
    console.log("Parsing star catalog, this may take a moment...");
    
    // Add options to limit fields and improve performance
    const parseOptions = {
      columns: true,
      skip_empty_lines: true,
      delimiter: isSemicolonSeparated ? ';' : ',',
      // Skip rows that don't meet our criteria using the on_record hook
      on_record: (record: any, {lines}: {lines: number}) => {
        // Only keep stars that:
        // 1. Have a name or proper name, or
        // 2. Are bright enough to be seen with the naked eye (mag < 6.0), or
        // 3. Have a Bayer/Flamsteed designation
        const hasName = record.proper || record.name || record.ProperName;
        const isBright = record.mag !== undefined && parseFloat(record.mag) < 6.0;
        const hasDesignation = record.bf || record.bayer || record.flam;
        
        if (hasName || isBright || hasDesignation) {
          return record;
        }
        return null; // Skip this record
      }
    };
    
    const records = parse(fileContent, parseOptions) as any[];
    console.log(`Parsed ${records.length} star records that meet criteria`);
    
    for (const record of records) {
      // Handle different catalog formats
      let name = record.name || record.Name || record.id || record.ID || '';
      
      // Extract common name and type first
      let common_name = record.common_name || record.commonName || record['common name'] || record.object || record.Object || '';
      let type = record.type || record.Type || record.TYPE || '';
      
      // Define coordinate variables
      let ra_hours: number | undefined;
      let dec_degrees: number | undefined;
      
      // Special handling for OpenNGC format - check NGC/IC column
      if (!name && record.Name) {
        name = record.Name;
      } else if (record.NGC && record.NGC !== '0') {
        name = 'NGC' + record.NGC;
      } else if (record.IC && record.IC !== '0') {
        name = 'IC' + record.IC;
      }
      
      // Special handling for OpenNGC repository format
      if (filePath.includes('OpenNGC') && filePath.endsWith('NGC.csv')) {
        // Handle OpenNGC's NGC.csv format with semicolon delimiter
        if (!name && record.Name) {
          name = record.Name;
        }
        
        // Use common name from the "Common names" field
        if (!common_name && record['Common names']) {
          common_name = record['Common names'];
        }
        
        // Use the Type field directly
        if (!type && record.Type) {
          type = record.Type;
        }
        
        // Handle RA format in OpenNGC (often in hours:minutes:seconds format)
        if (ra_hours === undefined && record.RA) {
          const raParts = record.RA.split(' ');
          if (raParts.length === 2) {
            // Format is likely "HH MM.mmm"
            const hours = parseFloat(raParts[0]);
            const minutes = parseFloat(raParts[1]);
            if (!isNaN(hours) && !isNaN(minutes)) {
              ra_hours = hours + (minutes / 60);
            }
          } else if (raParts.length === 3) {
            // Format is likely "HH MM SS.sss"
            const hours = parseFloat(raParts[0]);
            const minutes = parseFloat(raParts[1]);
            const seconds = parseFloat(raParts[2]);
            if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
              ra_hours = hours + (minutes / 60) + (seconds / 3600);
            }
          }
        }
        
        // Handle Dec format in OpenNGC (often in degrees:minutes:seconds format)
        if (dec_degrees === undefined && record.Dec) {
          const decParts = record.Dec.split(' ');
          if (decParts.length >= 2) {
            const degrees = parseFloat(decParts[0]);
            const minutes = parseFloat(decParts[1]);
            const seconds = decParts.length === 3 ? parseFloat(decParts[2]) : 0;
            
            if (!isNaN(degrees) && !isNaN(minutes) && !isNaN(seconds)) {
              const sign = degrees < 0 ? -1 : 1;
              dec_degrees = Math.abs(degrees) + (minutes / 60) + (seconds / 3600);
              dec_degrees *= sign; // Apply sign
            }
          }
        }
      }
      
      // These variables have been moved up before the OpenNGC handling
      
      // Handle RA/Dec in different formats
      if (record.ra_hours !== undefined) {
        ra_hours = parseFloat(record.ra_hours);
      } else if (record.RA !== undefined) {
        // Convert RA from degrees to hours if needed
        const ra = parseFloat(record.RA);
        ra_hours = ra / 15; // 15 degrees = 1 hour
      } else if (record.RAJ2000 !== undefined) {
        const ra = parseFloat(record.RAJ2000);
        ra_hours = ra / 15;
      } else if (record.RA_h !== undefined && record.RA_m !== undefined && record.RA_s !== undefined) {
        // Handle OpenNGC format with hours, minutes, seconds
        const h = parseFloat(record.RA_h);
        const m = parseFloat(record.RA_m);
        const s = parseFloat(record.RA_s);
        ra_hours = h + (m / 60) + (s / 3600);
      }
      
      if (record.dec_degrees !== undefined) {
        dec_degrees = parseFloat(record.dec_degrees);
      } else if (record.Dec !== undefined) {
        dec_degrees = parseFloat(record.Dec);
      } else if (record.DEJ2000 !== undefined) {
        dec_degrees = parseFloat(record.DEJ2000);
      } else if (record.DEC_d !== undefined && record.DEC_m !== undefined && record.DEC_s !== undefined) {
        // Handle OpenNGC format with degrees, minutes, seconds
        const d = parseFloat(record.DEC_d);
        const m = parseFloat(record.DEC_m);
        const s = parseFloat(record.DEC_s);
        const sign = d < 0 ? -1 : 1; // Handle negative declinations
        dec_degrees = Math.abs(d) + (m / 60) + (s / 3600);
        dec_degrees *= sign; // Apply sign
      }
      
      // Skip if we couldn't parse the coordinates
      if (!name || ra_hours === undefined || dec_degrees === undefined || isNaN(ra_hours) || isNaN(dec_degrees)) {
        continue;
      }
      
      // For NGC/IC catalogs, prepend NGC/IC if not already present
      if (filePath.toLowerCase().includes('ngc') && !name.startsWith('NGC') && !name.startsWith('IC') && !isNaN(parseInt(name))) {
        name = 'NGC' + name;
      }
      
      // Store the coordinates
      DSO_CATALOG.set(name, {
        rightAscension: ra_hours,
        declination: dec_degrees,
        commonName: common_name,
        type: type
      });
      
      // Store common name for lookup if available
      if (common_name) {
        COMMON_NAMES.set(common_name.toLowerCase(), name);
      }
    }
    
    console.log(`Loaded ${DSO_CATALOG.size} deep sky objects`);
  } catch (error) {
    console.error(`Failed to load DSO catalog: ${error}`);
    
    // Load hardcoded data as fallback
    Object.entries(HARDCODED_MESSIER_CATALOG).forEach(([name, coords]) => {
      DSO_CATALOG.set(name, coords);
    });
    
    Object.entries(HARDCODED_NGC_CATALOG).forEach(([name, coords]) => {
      DSO_CATALOG.set(name, coords);
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
        STAR_CATALOG.set(name, {
          rightAscension: coords.rightAscension,
          declination: coords.declination
        });
      });
      
      return;
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Detect if the file uses semicolons as separators
    const isSemicolonSeparated = fileContent.indexOf(';') !== -1 && fileContent.indexOf(',') === -1;
    
    // Parse based on separator
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: isSemicolonSeparated ? ';' : ','
    }) as any[];
    
    for (const record of records) {
      // Extract name data from different possible formats
      let name = record.name || record.proper || record.ProperName || '';
      let alt_name = record.alt_name || record.BayerFlamsteed || '';
      let constellation = record.constellation || record.Con || record.con || '';
      
      // Handle RA/Dec in different formats
      let ra_hours: number | undefined;
      let dec_degrees: number | undefined;
      
      if (record.ra_hours !== undefined) {
        ra_hours = parseFloat(record.ra_hours);
      } else if (record.RA !== undefined) {
        // Convert RA from degrees to hours if needed
        const ra = parseFloat(record.RA);
        ra_hours = ra / 15; // 15 degrees = 1 hour
      } else if (record.RArad !== undefined) {
        // Convert from radians
        const ra = parseFloat(record.RArad);
        ra_hours = (ra * 180 / Math.PI) / 15;
      } else if (record.ra !== undefined) {
        // Handle lowercase 'ra' field (as in HYG v41)
        const ra = parseFloat(record.ra);
        ra_hours = ra; // In HYG database, ra is already in hours
      } else if (record.rarad !== undefined) {
        // Handle lowercase rarad field
        const ra = parseFloat(record.rarad);
        ra_hours = (ra * 180 / Math.PI) / 15;
      }
      
      if (record.dec_degrees !== undefined) {
        dec_degrees = parseFloat(record.dec_degrees);
      } else if (record.Dec !== undefined) {
        dec_degrees = parseFloat(record.Dec);
      } else if (record.DErad !== undefined) {
        // Convert from radians
        dec_degrees = parseFloat(record.DErad) * 180 / Math.PI;
      } else if (record.dec !== undefined) {
        // Handle lowercase 'dec' field (as in HYG v41)
        dec_degrees = parseFloat(record.dec);
      } else if (record.decrad !== undefined) {
        // Handle lowercase decrad field
        dec_degrees = parseFloat(record.decrad) * 180 / Math.PI;
      }
      
      // For HYG catalog specifically
      if (filePath.toLowerCase().includes('hyg')) {
        // Handle specific columns in HYG Database format
        if (filePath.includes('hygdata_v') || filePath.includes('hyg_v')) {
          // These are the specific column names used in the HYG Database
          
          // For proper name, check the 'proper' column first
          if (!name && record.proper) {
            name = record.proper;
          }
          
          // Use Bayer-Flamsteed designation if proper name is missing
          if (!name && record.bf) {
            name = record.bf;
          } else if (!name && record.bayer) {
            // Try lowercase 'bayer' field
            name = record.bayer + ' ' + (constellation || record.con || '');
          }
          
          // Fall back to Flamsteed designation
          if (!name && record.flam) {
            name = record.flam + ' ' + (constellation || record.con || '');
          }
          
          // Use HD catalog number as last resort
          if (!name && record.hd) {
            name = 'HD ' + record.hd;
          }
          
          // If no name found but there's an HIP number, use that
          if (!name && record.hip) {
            name = 'HIP ' + record.hip;
          }
          
          // Last resort: use any star with magnitude < 6 (naked eye visible)
          if (!name && record.mag !== undefined && parseFloat(record.mag) < 6) {
            // For naked-eye visible stars without names, create a generic name
            const magValue = parseFloat(record.mag);
            name = `Star mag ${magValue.toFixed(2)}`;
            
            // Add constellation if available
            if (constellation || record.con) {
              name += ` in ${constellation || record.con}`;
            }
          }
        } else {
          // Legacy handling for other HYG-like formats
          if (!name && record.bayer) {
            name = record.bayer + ' ' + constellation;
          }
          
          // Use HD catalog number as last resort
          if (!name && record.hd) {
            name = 'HD ' + record.hd;
          }
        }
      }
      
      // Skip if we couldn't extract needed information
      if (!name || ra_hours === undefined || dec_degrees === undefined || isNaN(ra_hours) || isNaN(dec_degrees)) {
        continue;
      }
      
      // Store the coordinates under the primary name
      STAR_CATALOG.set(name, {
        rightAscension: ra_hours,
        declination: dec_degrees,
        altName: alt_name,
        constellation: constellation
      });
      
      // Also store under alternative name if available
      if (alt_name) {
        STAR_CATALOG.set(alt_name, {
          rightAscension: ra_hours,
          declination: dec_degrees,
          altName: name,
          constellation: constellation
        });
      }
    }
    
    console.log(`Loaded ${STAR_CATALOG.size} stars`);
  } catch (error) {
    console.error(`Failed to load star catalog: ${error}`);
    
    // Load hardcoded data as fallback
    Object.entries(HARDCODED_STAR_CATALOG).forEach(([name, coords]) => {
      STAR_CATALOG.set(name, {
        rightAscension: coords.rightAscension,
        declination: coords.declination
      });
    });
  }
}

/**
 * Initialize catalogs from data files
 */
export function initializeCatalogs(): void {
  const dataDir = path.join(__dirname, '../../data');
  
  // Only load catalogs from data directory
  try {
    // Check for required catalogs in data directory
    const dataCatalogs = [
      {
        path: path.join(dataDir, 'ngc.csv'),
        name: 'OpenNGC Catalog'
      },
      {
        path: path.join(dataDir, 'hygdata_v41.csv'),
        name: 'HYG Database v41'
      },
      {
        path: path.join(dataDir, 'enhanced_stars.csv'),
        name: 'Enhanced Star Catalog'
      },
      {
        path: path.join(dataDir, 'enhanced_dso.csv'),
        name: 'Enhanced DSO Catalog'
      }
    ];
    
    // Try to load Deep Sky Objects catalog
    let dsoCatalogLoaded = false;
    
    // Load from data directory
    if (fs.existsSync(dataCatalogs[0].path)) {
      console.log(`Loading DSO catalog from data directory: ${dataCatalogs[0].name}`);
      loadDSOCatalog(dataCatalogs[0].path);
      dsoCatalogLoaded = true;
    } else if (fs.existsSync(dataCatalogs[3].path)) {
      console.log(`Loading DSO catalog from data directory: ${dataCatalogs[3].name}`);
      loadDSOCatalog(dataCatalogs[3].path);
      dsoCatalogLoaded = true;
    } else {
      console.log('Primary catalogs not found, checking for alternative catalogs...');
      
      // Check for other potential catalogs
      const altDsoCatalogs = [
        'messier.csv',          // Messier catalog
        'dso.csv',              // Generic DSO catalog
        'sample_dso.csv'        // Sample (fallback)
      ];
      
      for (const catalog of altDsoCatalogs) {
        if (fs.existsSync(path.join(dataDir, catalog))) {
          loadDSOCatalog(path.join(dataDir, catalog));
          console.log(`Using DSO catalog from data directory: ${catalog}`);
          dsoCatalogLoaded = true;
          break;
        }
      }
      
      if (!dsoCatalogLoaded) {
        console.warn('No DSO catalog found, attempting to download...');
        try {
          // Try to download the catalog using the fetch-catalogs script
          const { execSync } = require('child_process');
          console.log('Downloading OpenNGC catalog...');
          execSync('npx ts-node src/fetch-catalogs.ts', { stdio: 'inherit' });
          
          // Check if download was successful
          if (fs.existsSync(dataCatalogs[0].path)) {
            console.log('Download successful, loading DSO catalog...');
            loadDSOCatalog(dataCatalogs[0].path);
            dsoCatalogLoaded = true;
          } else {
            console.warn('Download failed or catalog not found, using hardcoded data');
            loadDSOCatalog(path.join(dataDir, 'nonexistent.csv'));
          }
        } catch (error) {
          console.error('Error downloading catalog:', error);
          console.warn('Using hardcoded data as fallback');
          loadDSOCatalog(path.join(dataDir, 'nonexistent.csv'));
        }
      }
    }
    
    // Try to load Star catalog
    let starCatalogLoaded = false;
    
    // Load from data directory
    if (fs.existsSync(dataCatalogs[1].path)) {
      console.log(`Loading star catalog from data directory: ${dataCatalogs[1].name}`);
      loadStarCatalog(dataCatalogs[1].path);
      starCatalogLoaded = true;
    } else if (fs.existsSync(dataCatalogs[2].path)) {
      console.log(`Loading star catalog from data directory: ${dataCatalogs[2].name}`);
      loadStarCatalog(dataCatalogs[2].path);
      starCatalogLoaded = true;
    } else {
      console.log('Primary star catalogs not found, checking for alternatives...');
      
      // Check for other potential catalogs
      const altStarCatalogs = [
        'hygdata_v3.csv',       // Full HYG v3
        'hyg.csv',              // Any HYG format
        'stars.csv',            // Generic stars catalog
        'sample_stars.csv'      // Sample (fallback)
      ];
      
      for (const catalog of altStarCatalogs) {
        if (fs.existsSync(path.join(dataDir, catalog))) {
          loadStarCatalog(path.join(dataDir, catalog));
          console.log(`Using star catalog from data directory: ${catalog}`);
          starCatalogLoaded = true;
          break;
        }
      }
      
      if (!starCatalogLoaded) {
        console.warn('No star catalog found, attempting to download...');
        try {
          // Try to download the catalog using the fetch-catalogs script if not already tried
          if (!dsoCatalogLoaded) {
            const { execSync } = require('child_process');
            console.log('Downloading HYG Database...');
            execSync('npx ts-node src/fetch-catalogs.ts', { stdio: 'inherit' });
          }
          
          // Check if download was successful
          if (fs.existsSync(dataCatalogs[1].path)) {
            console.log('Download successful, loading star catalog...');
            loadStarCatalog(dataCatalogs[1].path);
            starCatalogLoaded = true;
          } else {
            console.warn('Download failed or catalog not found, using hardcoded data');
            loadStarCatalog(path.join(dataDir, 'nonexistent.csv'));
          }
        } catch (error) {
          console.error('Error downloading catalog:', error);
          console.warn('Using hardcoded data as fallback');
          loadStarCatalog(path.join(dataDir, 'nonexistent.csv'));
        }
      }
    }
  } catch (error) {
    console.error('Error loading catalogs:', error);
    // Fall back to sample catalogs
    loadDSOCatalog(path.join(dataDir, 'sample_dso.csv'));
    loadStarCatalog(path.join(dataDir, 'sample_stars.csv'));
  }
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
  if (isSolarSystemObject(normalizedName)) {
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
  
  // Handle stars - check the whole catalog with case-insensitive match
  for (const [starName, coords] of STAR_CATALOG.entries()) {
    if (starName.toLowerCase() === normalizedName) {
      return coords;
    }
  }
  
  // Handle deep sky objects - check the whole catalog with case-insensitive match
  for (const [dsoName, coords] of DSO_CATALOG.entries()) {
    if (dsoName.toLowerCase() === normalizedName) {
      return coords;
    }
  }
  
  // If we reach here, the object is not recognized
  throw new Error(`Unknown celestial object: ${objectName}`);
}

/**
 * Convert equatorial coordinates to horizontal (altitude-azimuth) coordinates
 * @param coords Equatorial coordinates
 * @param observer Observer information
 * @param date Date and time of observation
 * @returns Horizontal coordinates (altitude and azimuth)
 */
/**
 * Convert equatorial coordinates to horizontal (altitude-azimuth) coordinates
 * WITHOUT atmospheric refraction correction
 * 
 * @param coords Equatorial coordinates (RA in hours, Dec in degrees)
 * @param observer Observer information
 * @param date Date and time of observation (in UTC)
 * @returns Horizontal coordinates (altitude and azimuth in degrees)
 */
export function convertToAltAz(
  coords: EquatorialCoordinates,
  observer: Observer,
  date: Date
): HorizontalCoordinates {
  // Create observer object
  const observerObj = new Astronomy.Observer(
    observer.latitude,
    observer.longitude,
    observer.elevation
  );
  
  // Horizon function expects RA in hours (not degrees)
  // and we already have RA in hours in our coords object
  
  // Use Astronomy.Horizon to convert to horizontal coordinates
  // For refraction parameter: 'normal' = apply refraction, undefined = no refraction
  const horizontal = Astronomy.Horizon(
    date,
    observerObj,
    coords.rightAscension,
    coords.declination,
    undefined  // Disable refraction correction by not providing a value
  );
  
  return {
    altitude: horizontal.altitude,
    azimuth: horizontal.azimuth  // Azimuth: 0=North, 90=East, 180=South, 270=West
  };
}

/**
 * Check if an object is a solar system object
 * @param name Object name
 * @returns boolean
 */
function isSolarSystemObject(name: string): boolean {
  const solarSystemObjects = [
    'sun', 'moon', 'mercury', 'venus', 'earth', 'mars',
    'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'
  ];
  
  return solarSystemObjects.includes(name);
}

/**
 * Get coordinates for a solar system object
 * @param name Object name
 * @param date Date and time of observation (in UTC)
 * @returns Equatorial coordinates (right ascension in hours, declination in degrees)
 */
function getSolarSystemCoordinates(name: string, date: Date): EquatorialCoordinates {
  let body: Astronomy.Body;
  
  // Map the name to the Astronomy.js body enum
  switch (name) {
    case 'sun': body = Astronomy.Body.Sun; break;
    case 'moon': body = Astronomy.Body.Moon; break;
    case 'mercury': body = Astronomy.Body.Mercury; break;
    case 'venus': body = Astronomy.Body.Venus; break;
    case 'earth': body = Astronomy.Body.Earth; break;
    case 'mars': body = Astronomy.Body.Mars; break;
    case 'jupiter': body = Astronomy.Body.Jupiter; break;
    case 'saturn': body = Astronomy.Body.Saturn; break;
    case 'uranus': body = Astronomy.Body.Uranus; break;
    case 'neptune': body = Astronomy.Body.Neptune; break;
    case 'pluto': body = Astronomy.Body.Pluto; break;
    default: throw new Error(`Unknown solar system object: ${name}`);
  }
  
  // Create a default observer at the geocenter
  const geocentricObserver = new Astronomy.Observer(0, 0, 0);
  
  // Get equatorial coordinates - we need equator of date for accurate horizontal coordinate conversion
  // true for ofdate parameter to get coordinates relative to the Earth's equator at the specified time
  // false for aberration parameter (as per specification to not apply refraction correction)
  const equ = Astronomy.Equator(body, date, geocentricObserver, true, false);
  
  console.log(`Calculated coordinates for ${name} at ${date.toISOString()}: RA=${equ.ra.toFixed(4)}h, Dec=${equ.dec.toFixed(4)}°`);
  
  return {
    rightAscension: equ.ra,
    declination: equ.dec
  };
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
      objects: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
    });
  }
  
  if (category === 'all' || category === 'stars') {
    // Get unique star names (primary names only, not alternative names)
    const starNames = Array.from(STAR_CATALOG.keys()).filter(name => {
      const star = STAR_CATALOG.get(name);
      // Include all stars since we don't have many duplicates in our sample data
      return true;
    }).sort();
    
    result.push({
      category: 'Bright Stars',
      objects: starNames
    });
  }
  
  if (category === 'all' || category === 'dso') {
    // Separate Messier and NGC objects
    const messierObjects: string[] = [];
    const ngcObjects: string[] = [];
    const otherDsoObjects: string[] = [];
    
    Array.from(DSO_CATALOG.keys()).forEach(name => {
      if (name.startsWith('M') && /^M\d+$/.test(name)) {
        messierObjects.push(name);
      } else if (name.startsWith('NGC')) {
        ngcObjects.push(name);
      } else if (name.startsWith('IC')) {
        otherDsoObjects.push(name);
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
    
    if (ngcObjects.length > 0) {
      result.push({
        category: 'NGC Objects',
        objects: ngcObjects.sort()
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
