import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

// Plugin to transform 'vitest' imports in test files to use globals
function vitestGlobalsPlugin(): Plugin {
  return {
    name: 'vitest-globals-transform',
    enforce: 'pre',
    transform(code: string, id: string) {
      // Only transform test files
      if (!id.includes('.test.')) {
        return null;
      }
      
      // Replace vitest imports with global references
      if (code.includes("from 'vitest'") || code.includes('from "vitest"')) {
        const transformed = code
          .replace(/import\s*\{[^}]+\}\s*from\s*['"]vitest['"]\s*;?/g, '// vitest imports removed - using globals')
          .replace(/import\s+\*\s+as\s+\w+\s+from\s*['"]vitest['"]\s*;?/g, '// vitest imports removed - using globals');
        
        return {
          code: transformed,
          map: null,
        };
      }
      
      return null;
    },
  };
}

export default defineConfig({
  plugins: [vitestGlobalsPlugin()],
  test: {
    include: ['test/**/*.test.{ts,js}'],
    environment: 'node',
    globals: true,
  },
});
