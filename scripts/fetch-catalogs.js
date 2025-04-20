import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const DATA_DIR = path.join(process.cwd(), 'data');

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
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Download a file from URL
 */
async function downloadFile(url, destination) {
  const filePath = path.join(DATA_DIR, destination);
  console.log(`Downloading ${url} to ${filePath}...`);
  
  return new Promise((resolve, reject) => {
    // Determine which protocol to use
    const protocol = url.startsWith('https') ? https : http;
    
    // Make the HTTP/HTTPS request
    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        return;
      }
      
      // Create a write stream to save the file
      const fileStream = fs.createWriteStream(filePath);
      
      // Pipe the response to the file
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Successfully downloaded ${destination}`);
        resolve();
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(filePath, () => {}); // Delete the file if there's an error
        console.error(`Error writing to file: ${err.message}`);
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      console.error(`Error during request: ${err.message}`);
      reject(err);
    });
    
    request.end();
  });
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
main().catch(error => {
  console.error('An error occurred in the main process:', error);
  process.exit(1);
});
