/**
 * Watch Module Exports
 */

export { TraceProject, ProjectConfigSchema, findProject, loadProject } from './project.js';
export type { ProjectConfig } from './project.js';

export { SchemaCache } from './cache.js';

export { 
  TraceWatcher, 
  getWatcher, 
  stopWatcher, 
  listActiveWatchers 
} from './watcher.js';
export type { 
  WatchEvent, 
  WatchEventType, 
  FileChangeData, 
  ResultData 
} from './watcher.js';
