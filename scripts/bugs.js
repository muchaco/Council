#!/usr/bin/env node

/**
 * Bug Management CLI
 * 
 * Commands:
 *   create              - Create new bug report (interactive)
 *   get <id>            - Display bug details
 *   list [options]      - List bugs with filters
 *   mark <id> <status>  - Update bug status
 *   update <id>         - Update bug (interactive)
 *   search <query>      - Search bugs
 *   next                - Show top priority quick fix
 *   delete <id>         - Delete bug
 * 
 * Status values: open, in-progress, resolved, closed, wontfix
 * Priority values: low, medium, high, critical
 * Complexity: 1-10 (lower = easier to fix)
 */

const { program } = require('commander');
const path = require('path');
const { loadRegistry, saveRegistry, generateId, calculatePriorityScore } = require('./lib/registry');
const { promptBug, promptUpdate } = require('./lib/cli-helpers');
const { listItems, searchItems, findNextItem } = require('./lib/search');

const REGISTRY_PATH = path.join(__dirname, '..', 'bugs', 'index.json');
const ITEMS_DIR = path.join(__dirname, '..', 'bugs');
const TYPE = 'BUG';

program
  .name('bugs')
  .description('CLI for managing project bugs')
  .version('1.0.0');

program
  .command('create')
  .description('Create a new bug report interactively or from JSON')
  .option('--json <data>', 'Create from JSON string (for batch operations)')
  .action(async (options) => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      const id = generateId(TYPE, registry.metadata.nextId);
      
      let data;
      if (options.json) {
        data = JSON.parse(options.json);
      } else {
        data = await promptBug();
      }
      
      const item = {
        id,
        title: data.title,
        description: data.description,
        status: data.status || 'open',
        priority: data.priority,
        complexity: data.complexity,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        path: `bugs/${id}`
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
        path.join(itemDir, 'bug.json'),
        JSON.stringify(item, null, 2)
      );
      
      console.log(`✓ Created bug ${id}`);
      console.log(`  Path: ${item.path}`);
      console.log(`  Priority: ${item.priority} | Complexity: ${item.complexity}/10`);
    } catch (error) {
      console.error('Error creating bug:', error.message);
      process.exit(1);
    }
  });

program
  .command('get <id>')
  .description('Get bug details')
  .action((id) => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      const item = registry.items[id];
      
      if (!item) {
        console.error(`Bug ${id} not found`);
        process.exit(1);
      }
      
      const fs = require('fs');
      const itemPath = path.join(ITEMS_DIR, id, 'bug.json');
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
      console.error('Error getting bug:', error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List bugs')
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
        console.log('No bugs found.');
        return;
      }
      
      console.log(`\nFound ${items.length} bug(s):\n`);
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
      console.error('Error listing bugs:', error.message);
      process.exit(1);
    }
  });

program
  .command('mark <id> <status>')
  .description('Update bug status')
  .action((id, status) => {
    try {
      const validStatuses = ['open', 'in-progress', 'resolved', 'closed', 'wontfix'];
      
      if (!validStatuses.includes(status)) {
        console.error(`Invalid status. Valid: ${validStatuses.join(', ')}`);
        process.exit(1);
      }
      
      const registry = loadRegistry(REGISTRY_PATH);
      
      if (!registry.items[id]) {
        console.error(`Bug ${id} not found`);
        process.exit(1);
      }
      
      const fs = require('fs');
      const itemPath = path.join(ITEMS_DIR, id, 'bug.json');
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
  .description('Update bug interactively')
  .action(async (id) => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      
      if (!registry.items[id]) {
        console.error(`Bug ${id} not found`);
        process.exit(1);
      }
      
      const fs = require('fs');
      const itemPath = path.join(ITEMS_DIR, id, 'bug.json');
      const item = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
      
      const updates = await promptUpdate(item, 'bug');
      
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
      console.error('Error updating bug:', error.message);
      process.exit(1);
    }
  });

program
  .command('search <query>')
  .description('Search bugs')
  .action((query) => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      const fs = require('fs');
      const results = searchItems(registry.items, query, ITEMS_DIR, 'bug.json');
      
      if (results.length === 0) {
        console.log('No bugs found matching your query.');
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
  .description('Show top priority bug (lowest complexity, highest priority)')
  .option('-c, --complexity <n>', 'Max complexity threshold', parseInt)
  .action((options) => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      const item = findNextItem(registry.items, options.complexity, calculatePriorityScore);
      
      if (!item) {
        console.log('No open bugs found.');
        return;
      }
      
      const fs = require('fs');
      const itemPath = path.join(ITEMS_DIR, item.id, 'bug.json');
      const fullItem = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
      
      console.log(`\n🐛 Top Priority Bug:\n`);
      console.log(`${item.id}: ${fullItem.title}`);
      console.log(`Priority: ${fullItem.priority} | Complexity: ${fullItem.complexity}/10`);
      console.log(`Score: ${calculatePriorityScore(fullItem).toFixed(2)}`);
      console.log(`\n${fullItem.description}`);
      console.log();
    } catch (error) {
      console.error('Error finding next bug:', error.message);
      process.exit(1);
    }
  });

program
  .command('delete <id>')
  .description('Delete bug')
  .action((id) => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      
      if (!registry.items[id]) {
        console.error(`Bug ${id} not found`);
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
      console.error('Error deleting bug:', error.message);
      process.exit(1);
    }
  });

program.parse();
