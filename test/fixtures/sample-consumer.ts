/**
 * Test fixture: Sample Frontend Consumer
 * Mimics patterns from Quest Keeper frontend for testing consumer tracing
 */

interface McpClient {
  callTool(name: string, args: Record<string, unknown>): Promise<any>;
}

declare const client: McpClient;

// Example 1: Correct usage
async function loadCharacter(id: string) {
  const result = await client.callTool('get_character', { characterId: id });
  const data = JSON.parse(result.content[0].text);
  
  // Consumer expects these properties:
  console.log(data.name);
  console.log(data.race);
  console.log(data.level);
  console.log(data.stats.strength);
  
  // BUG: Using "characterClass" but producer returns "class"
  console.log(data.characterClass); // MISMATCH!
  
  return data;
}

// Example 2: Dice rolling
async function rollAttack() {
  const result = await client.callTool('roll_dice', { 
    notation: '1d20+5',
    reason: 'Attack roll'
  });
  const data = JSON.parse(result.content[0].text);
  
  // Correct property access
  console.log(data.total);
  console.log(data.rolls);
  
  return data;
}

// Example 3: Creating character with mismatched argument name
async function createHero(name: string, cls: string, race: string) {
  // BUG: Using "class" but tool expects "characterClass"
  const result = await client.callTool('create_character', {
    name,
    class: cls,  // MISMATCH! Should be "characterClass"
    race,
  });
  
  return JSON.parse(result.content[0].text);
}

export { loadCharacter, rollAttack, createHero };
