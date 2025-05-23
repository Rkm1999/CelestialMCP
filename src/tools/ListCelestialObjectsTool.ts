import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { listCelestialObjects } from '../utils/astronomy.js';

interface ListCelestialObjectsInput {
  category?: string;
}

class ListCelestialObjectsTool extends MCPTool<ListCelestialObjectsInput> {
  name = 'listCelestialObjects';
  description = "Lists available celestial objects that can be queried by other tools. Objects are grouped by category. You can request all objects, or filter by a specific category. This tool helps in discovering what objects are known to the system.";
  
  protected schema = {
    category: {
      type: z.string().optional(),
      description: "Optional. Filters the list by category. Valid categories are: 'planets' (for Solar System objects like Sun, Moon, and planets), 'stars', 'messier' (for Messier objects), 'ic' (for Index Catalogue objects), 'ngc' (for New General Catalogue objects), 'dso' (for all Deep Sky Objects, including Messier, IC, NGC, and others), or 'all' (to list objects from all available categories). If omitted, defaults to 'all'."
    }
  };

  async execute(params: ListCelestialObjectsInput) {
    try {
        const allCategoriesFromAstronomy = listCelestialObjects(); // Get all categories from astronomy.ts

        let relevantCategories: { category: string, objects: string[] }[] = [];

        if (params.category) {
            const requestedCategoryLower = params.category.toLowerCase();

            if (requestedCategoryLower === 'all') {
                const totalObjects = allCategoriesFromAstronomy.reduce((sum, cat) => sum + cat.objects.length, 0);
                return {
                    totalCategories: allCategoriesFromAstronomy.length,
                    totalObjects: totalObjects,
                    categories: allCategoriesFromAstronomy.map(cat => ({
                        category: cat.category,
                        objectCount: cat.objects.length,
                        objects: cat.objects
                    }))
                };
            } else if (requestedCategoryLower === 'dso') {
                const dsoCategories = allCategoriesFromAstronomy.filter(cat =>
                    cat.category === 'Messier Objects' ||
                    cat.category === 'IC Objects' ||
                    cat.category === 'NGC Objects' ||
                    cat.category === 'Other Deep Sky Objects'
                );
                const totalObjectsDSO = dsoCategories.reduce((sum, cat) => sum + cat.objects.length, 0);
                return {
                    totalCategories: dsoCategories.length,
                    totalObjects: totalObjectsDSO,
                    categories: dsoCategories.map(cat => ({
                        category: cat.category,
                        objectCount: cat.objects.length,
                        objects: cat.objects
                    }))
                };
            } else {
                // For specific categories like 'planets', 'stars', 'messier', 'ic', 'ngc'
                const targetCategory = allCategoriesFromAstronomy.find(cat => {
                    if (requestedCategoryLower === 'planets' && cat.category === 'Solar System Objects') return true;
                    if (requestedCategoryLower === 'stars' && cat.category === 'Stars') return true;
                    if (requestedCategoryLower === 'messier' && cat.category === 'Messier Objects') return true;
                    if (requestedCategoryLower === 'ic' && cat.category === 'IC Objects') return true;
                    if (requestedCategoryLower === 'ngc' && cat.category === 'NGC Objects') return true;
                    return false;
                });

                if (!targetCategory) {
                    const userFriendlyCategories = ['planets', 'stars', 'messier', 'ic', 'ngc', 'dso', 'all'];
                    return {
                        message: `No objects found in category "${params.category}". Available categories: ${userFriendlyCategories.join(', ')}.`,
                        availableCategories: userFriendlyCategories
                    };
                }

                return {
                    category: params.category, // Echo back the requested category
                    objectCount: targetCategory.objects.length,
                    objects: targetCategory.objects
                };
            }
        } else {
            // Default behavior if no category parameter is provided (same as 'all')
            const totalObjects = allCategoriesFromAstronomy.reduce((sum, cat) => sum + cat.objects.length, 0);
            return {
                totalCategories: allCategoriesFromAstronomy.length,
                totalObjects: totalObjects,
                categories: allCategoriesFromAstronomy.map(cat => ({
                    category: cat.category,
                    objectCount: cat.objects.length,
                    objects: cat.objects
                }))
            };
        }
    } catch (error: any) {
        throw new Error(`Failed to list celestial objects: ${error.message}`);
    }
    }
}

// Export the class directly (not an instance)
export default ListCelestialObjectsTool;