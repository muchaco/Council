/**
 * Registry management utilities
 */

const fs = require('fs');

/**
 * Priority weights for score calculation
 */
const PRIORITY_WEIGHTS = {
  'low': 1,
  'medium': 2,
  'high': 3,
  'critical': 4
};

/**
 * Load registry from file
 * @param {string} path - Path to registry JSON file
 * @returns {Object} Registry object
 */
function loadRegistry(path) {
  if (!fs.existsSync(path)) {
    return {
      items: {},
      metadata: { nextId: 1, lastUpdated: new Date().toISOString().split('T')[0] }
    };
  }
  
  const data = fs.readFileSync(path, 'utf8');
  return JSON.parse(data);
}

/**
 * Save registry to file
 * @param {string} path - Path to registry JSON file
 * @param {Object} registry - Registry object
 */
function saveRegistry(path, registry) {
  fs.writeFileSync(path, JSON.stringify(registry, null, 2));
}

/**
 * Generate sequential ID
 * @param {string} type - 'REQ' or 'BUG'
 * @param {number} nextId - Next ID number
 * @returns {string} Formatted ID (e.g., 'REQ-001')
 */
function generateId(type, nextId) {
  return `${type}-${String(nextId).padStart(3, '0')}`;
}

/**
 * Calculate priority score (higher = better to work on)
 * Formula: priority_weight / complexity
 * @param {Object} item - Item with priority and complexity
 * @returns {number} Score
 */
function calculatePriorityScore(item) {
  const priorityWeight = PRIORITY_WEIGHTS[item.priority] || 1;
  const complexity = Math.max(1, Math.min(10, item.complexity || 5));
  return priorityWeight / complexity;
}

module.exports = {
  loadRegistry,
  saveRegistry,
  generateId,
  calculatePriorityScore,
  PRIORITY_WEIGHTS
};
