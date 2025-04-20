import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { listCelestialObjects } from '../utils/astronomy.js';

interface ListCelestialObjectsInput {
  category?: string;
}

class ListCelestialObjectsTool extends MCPTool<ListCelestialObjectsInput> {
  name = 'listCelestialObjects';
  description = 'List all available celestial objects that can be queried';
  
  protected schema = {
    category: {
      type: z.string().optional(),
      description: 'Optional category filter ("planets", "stars", "dso", or "all"). Default is "all".'
    }
  };

  async execute(params: ListCelestialObjectsInput) {
    try {
      // Get all celestial objects from the astronomy utility
      const categories = listCelestialObjects();
      
      // Filter by category if specified
      if (params.category && params.category.toLowerCase() !== 'all') {
        const normalizedCategory = params.category.toLowerCase();
        
        // Map user-friendly categories to internal category names
        const categoryMap: Record<string, string> = {
          'planets': 'Solar System Objects',
          'stars': 'Stars',
          'dso': 'Deep Sky Objects'
        };
        
        const requestedCategory = categoryMap[normalizedCategory] || normalizedCategory;
        
        // Filter to just the requested category
        const filteredCategories = categories.filter(cat => 
          cat.category.toLowerCase() === requestedCategory.toLowerCase());
        
        if (filteredCategories.length === 0) {
          return {
            message: `No objects found in category "${params.category}". Available categories: planets, stars, dso.`,
            availableCategories: categories.map(cat => cat.category)
          };
        }
        
        return {
          category: filteredCategories[0].category,
          objectCount: filteredCategories[0].objects.length,
          objects: filteredCategories[0].objects
        };
      }
      
      // If no category specified, return all categories
      const totalObjects = categories.reduce((sum, cat) => sum + cat.objects.length, 0);
      
      return {
        totalCategories: categories.length,
        totalObjects: totalObjects,
        categories: categories.map(cat => ({
          category: cat.category,
          objectCount: cat.objects.length,
          objects: cat.objects
        }))
      };
    } catch (error: any) {
      throw new Error(`Failed to list celestial objects: ${error.message}`);
    }
  }
}

// Export the class directly (not an instance)
export default ListCelestialObjectsTool;
