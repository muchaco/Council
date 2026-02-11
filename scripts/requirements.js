#!/usr/bin/env node

/**
 * Requirements Management CLI
 * 
 * Commands:
 *   create              - Create new requirement (interactive)
 *   get <id>            - Display requirement details
 *   list [options]      - List requirements with filters
 *   mark <id> <status>  - Update requirement status
 *   classify <id> <type> - Update requirement type
 *   update <id>         - Update requirement (interactive)
 *   search <query>      - Search requirements
 *   next                - Show top priority low-hanging fruit
 *   stats               - Show registry requirement statistics
 *   delete <id>         - Delete requirement
 * 
 * Status values: draft, pending, in-progress, completed, cancelled
 * Type values: functional, non-functional
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
const VALID_REQUIREMENT_TYPES = ['functional', 'non-functional'];

function normalizeRequirementType(value) {
  if (!value) return 'functional';

  const normalized = String(value).trim().toLowerCase();
  if (['functional', 'fr', 'f'].includes(normalized)) {
    return 'functional';
  }
  if (['non-functional', 'nonfunctional', 'nfr', 'nf'].includes(normalized)) {
    return 'non-functional';
  }

  return null;
}

function calculateRequirementStats(items) {
  const allItems = Object.values(items);
  const stats = {
    total: allItems.length,
    byType: {
      functional: 0,
      'non-functional': 0
    },
    byStatus: {
      draft: 0,
      pending: 0,
      'in-progress': 0,
      completed: 0,
      cancelled: 0
    }
  };

  for (const item of allItems) {
    const itemType = item.type || 'functional';
    if (itemType === 'non-functional') {
      stats.byType['non-functional']++;
    } else {
      stats.byType.functional++;
    }

    if (Object.prototype.hasOwnProperty.call(stats.byStatus, item.status)) {
      stats.byStatus[item.status]++;
    }
  }

  return stats;
}

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
        type: normalizeRequirementType(data.type) || 'functional',
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
        type: item.type,
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
      console.log(`Type:       ${fullItem.type || 'functional'}`);
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
  .option('-t, --type <type>', 'Filter by type: functional, non-functional')
  .option('-c, --complexity <n>', 'Filter by max complexity', parseInt)
  .option('-l, --limit <n>', 'Limit results', parseInt)
  .option('--sort <field>', 'Sort by: priority, complexity, score, created, updated', 'score')
  .option('--asc', 'Sort ascending')
  .action((options) => {
    try {
      if (options.type) {
        const normalizedType = normalizeRequirementType(options.type);
        if (!normalizedType) {
          console.error(`Invalid type. Valid: ${VALID_REQUIREMENT_TYPES.join(', ')}`);
          process.exit(1);
        }
        options.type = normalizedType;
      }

      const registry = loadRegistry(REGISTRY_PATH);
      const items = listItems(registry.items, options, calculatePriorityScore);
      
      if (items.length === 0) {
        console.log('No requirements found.');
        return;
      }
      
      console.log(`\nFound ${items.length} requirement(s):\n`);
      console.log('ID       Type            Status        Priority  Cpx  Score  Title');
      console.log('-'.repeat(80));
      
      items.forEach(item => {
        const score = calculatePriorityScore(item);
        const typePadded = (item.type || 'functional').padEnd(14);
        const statusPadded = item.status.padEnd(13);
        const priorityPadded = item.priority.padEnd(8);
        console.log(
          `${item.id}  ${typePadded}  ${statusPadded}  ${priorityPadded}  ${String(item.complexity).padStart(2)}  ${score.toFixed(2).padStart(5)}  ${item.title.substring(0, 30)}${item.title.length > 30 ? '...' : ''}`
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
      registry.items[id].type = item.type || 'functional';
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
        console.log(`  Type: ${(item.type || 'functional')} | Status: ${item.status} | Priority: ${item.priority} | Complexity: ${item.complexity}`);
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
      console.log(`Type: ${(fullItem.type || 'functional')}`);
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
  .command('classify <id> <type>')
  .description('Set requirement type (functional/non-functional)')
  .action((id, type) => {
    try {
      const normalizedType = normalizeRequirementType(type);
      if (!normalizedType) {
        console.error(`Invalid type. Valid: ${VALID_REQUIREMENT_TYPES.join(', ')}`);
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

      item.type = normalizedType;
      item.updatedAt = new Date().toISOString().split('T')[0];

      registry.items[id].type = normalizedType;
      registry.items[id].updatedAt = item.updatedAt;
      registry.metadata.lastUpdated = new Date().toISOString().split('T')[0];

      saveRegistry(REGISTRY_PATH, registry);
      fs.writeFileSync(itemPath, JSON.stringify(item, null, 2));

      console.log(`✓ Set ${id} type to ${normalizedType}`);
    } catch (error) {
      console.error('Error classifying requirement:', error.message);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show requirement stats including type counts')
  .action(() => {
    try {
      const registry = loadRegistry(REGISTRY_PATH);
      const stats = calculateRequirementStats(registry.items);

      console.log('\nRequirement Stats');
      console.log('='.repeat(50));
      console.log(`Total:            ${stats.total}`);
      console.log(`Functional:       ${stats.byType.functional}`);
      console.log(`Non-Functional:   ${stats.byType['non-functional']}`);
      console.log('');
      console.log('By Status');
      console.log('-'.repeat(50));
      console.log(`Draft:            ${stats.byStatus.draft}`);
      console.log(`Pending:          ${stats.byStatus.pending}`);
      console.log(`In Progress:      ${stats.byStatus['in-progress']}`);
      console.log(`Completed:        ${stats.byStatus.completed}`);
      console.log(`Cancelled:        ${stats.byStatus.cancelled}`);
      console.log('');
    } catch (error) {
      console.error('Error showing stats:', error.message);
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
