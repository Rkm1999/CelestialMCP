import { MCPTool } from 'mcp-framework';
import { z } from 'zod';

interface ListCelestialObjectsInput {
  category?: string;
}

class ListCelestialObjectsTool extends MCPTool<ListCelestialObjectsInput> {
  name = 'listCelestialObjects';
  description = 'Get a list of supported celestial objects by category';
  
  protected schema = {
    category: {
      type: z.string().optional(),
      description: 'Filter by category (planets, stars, dso, all)'
    }
  };

  async execute(params: ListCelestialObjectsInput) {
    const category = params.category?.toLowerCase() || 'all';
    
    let result: { category: string, objects: string[] }[] = [];
    
    if (category === 'all' || category === 'planets') {
      result.push({
        category: 'Solar System Objects',
        objects: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
      });
    }
    
    if (category === 'all' || category === 'stars') {
      result.push({
        category: 'Bright Stars',
        objects: [
          'Sirius', 'Canopus', 'Arcturus', 'Vega', 'Capella', 
          'Rigel', 'Procyon', 'Betelgeuse', 'Achernar', 'Polaris',
          'Altair', 'Aldebaran', 'Antares', 'Spica', 'Pollux',
          'Deneb', 'Regulus', 'Fomalhaut', 'Castor'
        ]
      });
    }
    
    if (category === 'all' || category === 'dso') {
      result.push({
        category: 'Messier Objects',
        objects: ['M1', 'M8', 'M13', 'M31', 'M42', 'M45', 'M51', 'M57', 'M81', 'M82', 'M87', 'M104']
      });
      
      result.push({
        category: 'NGC Objects',
        objects: ['NGC7000', 'NGC6960', 'NGC5139', 'NGC4565', 'NGC6992']
      });
    }
    
    return {
      totalObjectCount: result.reduce((sum, cat) => sum + cat.objects.length, 0),
      categories: result
    };
  }
}

export default new ListCelestialObjectsTool();
