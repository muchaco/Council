#!/usr/bin/env node

/**
 * Requirements Management CLI
 * 
 * Commands:
 *   create              - Create new requirement (interactive)
 *   get <id>            - Display requirement details
 *   list [options]      - List requirements with filters
 *   mark <id> <status>  - Update requirement status
 *   update <id>         - Update requirement (interactive)
 *   search <query>      - Search requirements
 *   next                - Show top priority low-hanging fruit
 *   delete <id>         - Delete requirement
 * 
 * Status values: draft, pending, in-progress, completed, cancelled
 * Priority values: low, medium, high, critical
 * Complexity: 1-10 (lower = easier)
 */

const { program } = require('commander');
const path = require('path');
const { loadRegistry, saveRegistry, generateId, calculatePriorityScore } = require('./lib/registry');
const { promptRequirement, promptUpdate } = require('./lib/cli-helpers');
const { listItems, searchItems, findNextItem } = require('./lib/search');

const REGISTRY_PATH = path.join(__dirname, '..', 'requirements', 'index.json');
const ITEMS_DIR = path.join(__dirname, '..', 'requirements');
const TYPE = 'REQ';

program
  .name('requirements')
  .description('CLI for managing project requirements')
  .version('1.0.0');

program
  .command('create')
  .description('Create a new requirement interactively or from JSON')
  .option('--json <data>', 'Create from JSON string (for batch operations)')
  .action(async (options) => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      const id = generateId(TYPE, registry.metadata.nextId);
      
      let data;
      if (options.json) {
        data = JSON.parse(options.json);
      } else {
        data = await promptRequirement();
      }
      
      const item = {
        id,
        title: data.title,
        description: data.description,
        status: data.status || 'pending',
        priority: data.priority,
        complexity: data.complexity,
        createdAt: data.createdAt || new Date().toISOString().split('T')[0],
        updatedAt: data.updatedAt || new Date().toISOString().split('T')[0],
        path: `requirements/${id}`
      };
      
      registry.items[id] = {
        id,
        title: item.title,
        status: item.status,
        priority: item.priority,
        complexity: item.complexity,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        path: item.path
      };
      
      registry.metadata.nextId++;
      registry.metadata.lastUpdated = new Date().toISOString().split('T')[0];
      
      saveRegistry(REGISTRY_PATH, registry);
      
      const fs = require('fs');
      const itemDir = path.join(ITEMS_DIR, id);
      if (!fs.existsSync(itemDir)) {
        fs.mkdirSync(itemDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(itemDir, 'requirement.json'),
        JSON.stringify(item, null, 2)
      );
      
      console.log(`✓ Created requirement ${id}`);
      console.log(`  Path: ${item.path}`);
      console.log(`  Priority: ${item.priority} | Complexity: ${item.complexity}/10`);
    } catch (error) {
      console.error('Error creating requirement:', error.message);
      process.exit(1);
    }
  });

program
  .command('get <id>')
  .description('Get requirement details')
  .action((id) => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      const item = registry.items[id];
      
      if (!item) {
        console.error(`Requirement ${id} not found`);
        process.exit(1);
      }
      
      const fs = require('fs');
      const itemPath = path.join(ITEMS_DIR, id, 'requirement.json');
      const fullItem = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
      
      console.log(`\n${id}: ${fullItem.title}`);
      console.log('=' .repeat(50));
      console.log(`Status:     ${fullItem.status}`);
      console.log(`Priority:   ${fullItem.priority}`);
      console.log(`Complexity: ${fullItem.complexity}/10`);
      console.log(`Score:      ${calculatePriorityScore(fullItem).toFixed(2)} (higher = better)`);
      console.log(`Created:    ${fullItem.createdAt}`);
      console.log(`Updated:    ${fullItem.updatedAt}`);
      console.log(`\nDescription:`);
      console.log(fullItem.description);
      console.log();
    } catch (error) {
      console.error('Error getting requirement:', error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List requirements')
  .option('-s, --status <status>', 'Filter by status')
  .option('-p, --priority <priority>', 'Filter by priority')
  .option('-c, --complexity <n>', 'Filter by max complexity', parseInt)
  .option('-l, --limit <n>', 'Limit results', parseInt)
  .option('--sort <field>', 'Sort by: priority, complexity, score, created, updated', 'score')
  .option('--asc', 'Sort ascending')
  .action((options) => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      const items = listItems(registry.items, options, calculatePriorityScore);
      
      if (items.length === 0) {
        console.log('No requirements found.');
        return;
      }
      
      console.log(`\nFound ${items.length} requirement(s):\n`);
      console.log('ID       Status        Priority  Cpx  Score  Title');
      console.log('-'.repeat(80));
      
      items.forEach(item => {
        const score = calculatePriorityScore(item);
        const statusPadded = item.status.padEnd(13);
        const priorityPadded = item.priority.padEnd(8);
        console.log(
          `${item.id}  ${statusPadded}  ${priorityPadded}  ${String(item.complexity).padStart(2)}  ${score.toFixed(2).padStart(5)}  ${item.title.substring(0, 40)}${item.title.length > 40 ? '...' : ''}`
        );
      });
      console.log();
    } catch (error) {
      console.error('Error listing requirements:', error.message);
      process.exit(1);
    }
  });

program
  .command('mark <id> <status>')
  .description('Update requirement status')
  .action((id, status) => {
    try {
      const validStatuses = ['draft', 'pending', 'in-progress', 'completed', 'cancelled'];
      
      if (!validStatuses.includes(status)) {
        console.error(`Invalid status. Valid: ${validStatuses.join(', ')}`);
        process.exit(1);
      }
      
      const registry = loadRegistry(REGISTRY_PATH);
      
      if (!registry.items[id]) {
        console.error(`Requirement ${id} not found`);
        process.exit(1);
      }
      
      const fs = require('fs');
      const itemPath = path.join(ITEMS_DIR, id, 'requirement.json');
      const item = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
      
      item.status = status;
      item.updatedAt = new Date().toISOString().split('T')[0];
      
      registry.items[id].status = status;
      registry.items[id].updatedAt = item.updatedAt;
      registry.metadata.lastUpdated = new Date().toISOString().split('T')[0];
      
      saveRegistry(REGISTRY_PATH, registry);
      fs.writeFileSync(itemPath, JSON.stringify(item, null, 2));
      
      console.log(`✓ Marked ${id} as ${status}`);
    } catch (error) {
      console.error('Error updating status:', error.message);
      process.exit(1);
    }
  });

program
  .command('update <id>')
  .description('Update requirement interactively')
  .action(async (id) => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      
      if (!registry.items[id]) {
        console.error(`Requirement ${id} not found`);
        process.exit(1);
      }
      
      const fs = require('fs');
      const itemPath = path.join(ITEMS_DIR, id, 'requirement.json');
      const item = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
      
      const updates = await promptUpdate(item, 'requirement');
      
      Object.assign(item, updates);
      item.updatedAt = new Date().toISOString().split('T')[0];
      
      registry.items[id].title = item.title;
      registry.items[id].priority = item.priority;
      registry.items[id].complexity = item.complexity;
      registry.items[id].updatedAt = item.updatedAt;
      registry.metadata.lastUpdated = new Date().toISOString().split('T')[0];
      
      saveRegistry(REGISTRY_PATH, registry);
      fs.writeFileSync(itemPath, JSON.stringify(item, null, 2));
      
      console.log(`✓ Updated ${id}`);
    } catch (error) {
      console.error('Error updating requirement:', error.message);
      process.exit(1);
    }
  });

program
  .command('search <query>')
  .description('Search requirements')
  .action((query) => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      const fs = require('fs');
      const results = searchItems(registry.items, query, ITEMS_DIR, 'requirement.json');
      
      if (results.length === 0) {
        console.log('No requirements found matching your query.');
        return;
      }
      
      console.log(`\nFound ${results.length} match(es) for "${query}":\n`);
      results.forEach(item => {
        console.log(`${item.id}: ${item.title}`);
        console.log(`  Status: ${item.status} | Priority: ${item.priority} | Complexity: ${item.complexity}`);
        console.log();
      });
    } catch (error) {
      console.error('Error searching:', error.message);
      process.exit(1);
    }
  });

program
  .command('next')
  .description('Show top priority requirement (lowest complexity, highest priority)')
  .option('-c, --complexity <n>', 'Max complexity threshold', parseInt)
  .action((options) => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      const item = findNextItem(registry.items, options.complexity, calculatePriorityScore);
      
      if (!item) {
        console.log('No pending requirements found.');
        return;
      }
      
      const fs = require('fs');
      const itemPath = path.join(ITEMS_DIR, item.id, 'requirement.json');
      const fullItem = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
      
      console.log(`\n🎯 Top Priority Requirement:\n`);
      console.log(`${item.id}: ${fullItem.title}`);
      console.log(`Priority: ${fullItem.priority} | Complexity: ${fullItem.complexity}/10`);
      console.log(`Score: ${calculatePriorityScore(fullItem).toFixed(2)}`);
      console.log(`\n${fullItem.description}`);
      console.log();
    } catch (error) {
      console.error('Error finding next item:', error.message);
      process.exit(1);
    }
  });

program
  .command('delete <id>')
  .description('Delete requirement')
  .action((id) => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      
      if (!registry.items[id]) {
        console.error(`Requirement ${id} not found`);
        process.exit(1);
      }
      
      const fs = require('fs');
      const itemDir = path.join(ITEMS_DIR, id);
      
      // Delete directory
      fs.rmSync(itemDir, { recursive: true, force: true });
      
      // Update registry
      delete registry.items[id];
      registry.metadata.lastUpdated = new Date().toISOString().split('T')[0];
      
      saveRegistry(REGISTRY_PATH, registry);
      
      console.log(`✓ Deleted ${id}`);
    } catch (error) {
      console.error('Error deleting requirement:', error.message);
      process.exit(1);
    }
  });

program.parse();
