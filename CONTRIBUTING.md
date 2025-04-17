# Contributing to Celestial Position MCP Server

Thank you for your interest in contributing to the Celestial Position MCP Server!

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/celestial-position-mcp.git
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Download the catalogs:
   ```bash
   npm run fetch-catalogs
   ```
5. Make your changes
6. Build and test your changes:
   ```bash
   npm run build
   npm start
   ```
7. Commit your changes and push to your fork
8. Submit a pull request

## Project Structure

- `src/index.ts` - Entry point
- `src/server.ts` - MCP server implementation  
- `src/config.ts` - Location and server configuration
- `src/fetch-catalogs.ts` - Script to download catalog files
- `src/utils/astronomy.ts` - Star and DSO catalog handling and coordinate calculations
- `src/tools/` - Tool implementations (getCelestialPosition, listCelestialObjects)
- `data/` - Astronomical catalog files (note: large catalog files are not included in the repository)

## Coding Standards

- Use TypeScript for all new code
- Follow the existing code style
- Include comments for complex logic
- Update documentation as needed

## Pull Request Process

1. Ensure all your changes are working properly
2. Update the README.md if needed
3. Update the version number in package.json if applicable
4. Submit your pull request with a clear description of the changes

## Working with Astronomical Catalogs

The project uses two main astronomical catalogs:
- HYG Database v41 (for stars)
- OpenNGC Catalog (for deep sky objects)

These files are large and not included in the repository. The `fetch-catalogs.ts` script will download them automatically.

When making changes to catalog handling, be sure to test with both catalogs. The server can also fall back to hardcoded data if the catalogs are not available.
