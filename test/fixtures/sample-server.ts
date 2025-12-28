/**
 * Test fixture: Sample MCP Server
 * Mimics patterns from rpg-mcp server for testing extraction
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'test-rpg-server',
  version: '1.0.0',
});

// Tool 1: Get character info
server.tool(
  'get_character',
  'Retrieves character information by ID',
  {
    characterId: z.string().describe('The unique character identifier'),
  },
  async ({ characterId }) => {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          id: characterId,
          name: 'Test Hero',
          class: 'Fighter',  // Note: "class" not "characterClass"
          race: 'Human',
          level: 5,
          stats: {
            strength: 16,
            dexterity: 14,
            constitution: 15,
          }
        })
      }]
    };
  }
);

// Tool 2: Roll dice
server.tool(
  'roll_dice',
  'Rolls dice using standard notation',
  {
    notation: z.string().describe('Dice notation like 2d6+3'),
    reason: z.string().optional().describe('Why the roll is being made'),
  },
  async ({ notation, reason }) => {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          notation,
          total: 15,
          rolls: [4, 6, 5],
          reason,
        })
      }]
    };
  }
);

// Tool 3: Create character
server.tool(
  'create_character',
  'Creates a new character',
  {
    name: z.string().min(1),
    characterClass: z.enum(['Fighter', 'Wizard', 'Rogue', 'Cleric']),
    race: z.enum(['Human', 'Elf', 'Dwarf', 'Halfling']),
  },
  async ({ name, characterClass, race }) => {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          id: 'char_123',
          name,
          class: characterClass,
          race,
          level: 1,
        })
      }]
    };
  }
);

export { server };
