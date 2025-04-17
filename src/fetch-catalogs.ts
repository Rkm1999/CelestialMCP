import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

const DATA_DIR = path.join(__dirname, '../data');

// Catalog URLs - using raw GitHub URLs directly
const CATALOGS = [
  {
    url: 'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv',
    destination: 'ngc.csv',
    description: 'OpenNGC Catalog'
  },
  {
    url: 'https://raw.githubusercontent.com/astronexus/HYG-Database/master/hyg/CURRENT/hygdata_v41.csv',
    destination: 'hygdata_v41.csv',
    description: 'HYG Database v41'
  }
];

/**
 * Ensure directory exists
 */
function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Download a file from URL
 */
async function downloadFile(url: string, destination: string): Promise<void> {
  const filePath = path.join(DATA_DIR, destination);
  console.log(`Downloading ${url} to ${filePath}...`);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.statusText}`);
    }
    
    // Create a write stream to save the file
    const fileStream = fs.createWriteStream(filePath);
    
    return new Promise((resolve, reject) => {
      // Pipe the response body to the file
      response.body?.pipe(fileStream);
      
      fileStream.on('finish', () => {
        console.log(`Successfully downloaded ${destination}`);
        resolve();
      });
      
      fileStream.on('error', (err) => {
        console.error(`Error writing to file: ${err.message}`);
        reject(err);
      });
    });
  } catch (error) {
    console.error(`Error downloading file: ${error}`);
    throw error;
  }
}

/**
 * Main function to download all catalogs
 */
async function main() {
  // Ensure data directory exists
  ensureDirectoryExists(DATA_DIR);
  
  // Try to download each catalog
  for (const catalog of CATALOGS) {
    try {
      await downloadFile(catalog.url, catalog.destination);
    } catch (error) {
      console.error(`Failed to download ${catalog.description}: ${error}`);
      console.log('Continuing with next catalog...');
    }
  }
  
  console.log('\nCatalog download complete!');
  console.log('You can now restart the server to use the downloaded catalogs.');
}

// Run the main function
main();
