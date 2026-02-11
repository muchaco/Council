/**
 * Migration script: Convert requirements.md to registry format
 * 
 * This script parses the existing requirements.md file and creates
 * registry entries for all requirements found.
 * 
 * Run: node scripts/migrate-requirements.js
 */

const fs = require('fs');
const path = require('path');
const { loadRegistry, saveRegistry, generateId } = require('./lib/registry');

const requirementsPath = path.join(__dirname, '..', 'requirements.md');
const registryPath = path.join(__dirname, '..', 'requirements', 'index.json');
const itemsDir = path.join(__dirname, '..', 'requirements');

// Parse priority and complexity from the markdown format
function parseImportanceComplexity(text) {
  const priorityMatch = text.match(/-\s*\*\*Importance\*\*:\s*\`?(Critical|High|Medium|Low)\`?/i);
  const complexityMatch = text.match(/-\s*\*\*Complexity\*\*:\s*\`?(Simple|Medium|Complex|Very Complex)\`?/i);
  
  const priority = priorityMatch ? priorityMatch[1].toLowerCase() : 'medium';
  
  // Map complexity keywords to 1-10 scale
  const complexityMap = {
    'simple': 2,
    'medium': 5,
    'complex': 7,
    'very complex': 9
  };
  
  let complexity = 5;
  if (complexityMatch) {
    const key = complexityMatch[1].toLowerCase();
    complexity = complexityMap[key] || 5;
  }
  
  return { priority, complexity };
}

// Parse status
function parseStatus(text) {
  const statusMatch = text.match(/-\s*\*\*Status\*\*:\s*(✅|⚠️|⏳)?\s*(Implemented|Partial|Pending|In Progress)?/i);
  if (!statusMatch) return 'pending';
  
  const symbol = statusMatch[1];
  const word = statusMatch[2]?.toLowerCase();
  
  if (symbol === '✅' || word === 'implemented') return 'completed';
  if (symbol === '⚠️' || word === 'partial') return 'in-progress';
  if (word === 'in progress') return 'in-progress';
  return 'pending';
}

// Parse description
function parseDescription(text) {
  const descMatch = text.match(/\*\*Description\*\*:\s*(.+?)(?=\n\n|\n- \*\*|$)/s);
  if (descMatch) {
    return descMatch[1].trim().replace(/\n\s+/g, '\n');
  }
  return '';
}

// Parse implementation notes
function parseNotes(text) {
  const notesMatch = text.match(/-\s*\*\*Implementation Notes\*\*:\s*(.+?)(?=\n\n|$|\n-)/s);
  if (notesMatch) {
    return notesMatch[1].trim().replace(/\n\s+/g, '\n');
  }
  return '';
}

function migrate() {
  if (!fs.existsSync(requirementsPath)) {
    console.log('No requirements.md file found. Nothing to migrate.');
    return;
  }
  
  const content = fs.readFileSync(requirementsPath, 'utf8');
  
  // Find all requirement sections (FR-XXX or NFR-XXX)
  const requirementPattern = /###\s+(FR-[\d.]+|NFR-[\d]+|OOS-[\d]+):\s*(.+?)\n/g;
  const matches = [];
  let match;
  
  while ((match = requirementPattern.exec(content)) !== null) {
    const id = match[1];
    const title = match[2];
    const startPos = match.index;
    
    // Find the end of this requirement (next ### or end of string)
    const nextMatch = requirementPattern.exec(content);
    const endPos = nextMatch ? nextMatch.index : content.length;
    requirementPattern.lastIndex = startPos + 1; // Reset for next iteration
    
    const sectionContent = content.substring(startPos, endPos);
    
    const { priority, complexity } = parseImportanceComplexity(sectionContent);
    const status = parseStatus(sectionContent);
    let description = parseDescription(sectionContent);
    const notes = parseNotes(sectionContent);
    
    if (notes) {
      description += '\n\n**Implementation Notes:**\n' + notes;
    }
    
    matches.push({
      id,
      title,
      description,
      priority,
      complexity,
      status,
      type: id.startsWith('FR') ? 'Functional' : id.startsWith('NFR') ? 'Non-Functional' : 'Out of Scope'
    });
  }
  
  console.log(`Found ${matches.length} requirements in requirements.md`);
  
  if (matches.length === 0) {
    console.log('No requirements to migrate.');
    return;
  }
  
  const registry = loadRegistry(registryPath);
  
  matches.forEach((req, index) => {
    const registryId = generateId('REQ', index + 1);
    
    const item = {
      id: registryId,
      title: req.title,
      description: req.description,
      status: req.status,
      priority: req.priority,
      complexity: req.complexity,
      originalId: req.id,
      type: req.type === 'Functional' ? 'functional' : req.type === 'Non-Functional' ? 'non-functional' : 'functional',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      path: `requirements/${registryId}`
    };
    
    registry.items[registryId] = {
      id: registryId,
      title: item.title,
      type: item.type,
      status: item.status,
      priority: item.priority,
      complexity: item.complexity,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      path: item.path
    };
    
    const itemDir = path.join(itemsDir, registryId);
    if (!fs.existsSync(itemDir)) {
      fs.mkdirSync(itemDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(itemDir, 'requirement.json'),
      JSON.stringify(item, null, 2)
    );
    
    console.log(`✓ Created ${registryId} (${req.id}: ${req.title})`);
  });
  
  registry.metadata.nextId = matches.length + 1;
  registry.metadata.lastUpdated = new Date().toISOString().split('T')[0];
  
  saveRegistry(registryPath, registry);
  
  console.log(`\n✅ Migrated ${matches.length} requirements to registry`);
  console.log(`\nNext steps:`);
  console.log(`- Archive or delete the old requirements.md file`);
  console.log(`- Use 'npm run req:list' to see all requirements`);
  console.log(`- Use 'npm run req:next' to find top priority items`);
}

migrate();
