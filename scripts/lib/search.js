/**
 * Search and filter utilities
 */

const fs = require('fs');
const path = require('path');

/**
 * List items with filters and sorting
 * @param {Object} items - Registry items object
 * @param {Object} options - Filter options
 * @param {Function} calculateScore - Score calculation function
 * @returns {Array}
 */
function listItems(items, options, calculateScore) {
  let results = Object.values(items);
  
  // Apply filters
  if (options.status) {
    results = results.filter(item => item.status === options.status);
  }
  
  if (options.priority) {
    results = results.filter(item => item.priority === options.priority);
  }
  
  if (options.complexity) {
    results = results.filter(item => item.complexity <= options.complexity);
  }
  
  // Sort
  const sortField = options.sort || 'score';
  const asc = options.asc || false;
  
  results.sort((a, b) => {
    let aVal, bVal;
    
    switch (sortField) {
      case 'priority':
        const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        aVal = priorityOrder[a.priority] || 0;
        bVal = priorityOrder[b.priority] || 0;
        break;
      case 'complexity':
        aVal = a.complexity;
        bVal = b.complexity;
        break;
      case 'score':
        aVal = calculateScore(a);
        bVal = calculateScore(b);
        break;
      case 'created':
        aVal = new Date(a.createdAt);
        bVal = new Date(b.createdAt);
        break;
      case 'updated':
        aVal = new Date(a.updatedAt);
        bVal = new Date(b.updatedAt);
        break;
      default:
        aVal = a.title;
        bVal = b.title;
    }
    
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return asc ? comparison : -comparison;
  });
  
  // Apply limit
  if (options.limit) {
    results = results.slice(0, options.limit);
  }
  
  return results;
}

/**
 * Search items by query string
 * @param {Object} items - Registry items
 * @param {string} query - Search query
 * @param {string} itemsDir - Directory containing item folders
 * @param {string} filename - JSON filename to search in
 * @returns {Array} Matching items
 */
function searchItems(items, query, itemsDir, filename) {
  const results = [];
  const lowerQuery = query.toLowerCase();
  
  for (const id in items) {
    const item = items[id];
    
    // Search in title
    if (item.title.toLowerCase().includes(lowerQuery)) {
      results.push(item);
      continue;
    }
    
    // Search in file
    const itemPath = path.join(itemsDir, id, filename);
    if (fs.existsSync(itemPath)) {
      try {
        const fullItem = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
        if (fullItem.description && fullItem.description.toLowerCase().includes(lowerQuery)) {
          results.push(item);
        }
      } catch (e) {
        // Skip if can't read
      }
    }
  }
  
  return results;
}

/**
 * Find next item to work on (highest priority/complexity ratio)
 * Filters out completed/resolved items
 * @param {Object} items - Registry items
 * @param {number} maxComplexity - Max complexity threshold (optional)
 * @param {Function} calculateScore - Score calculation function
 * @returns {Object|null}
 */
function findNextItem(items, maxComplexity, calculateScore) {
  const pendingStatuses = ['draft', 'pending', 'open', 'in-progress'];
  
  let candidates = Object.values(items).filter(item => 
    pendingStatuses.includes(item.status)
  );
  
  if (maxComplexity) {
    candidates = candidates.filter(item => item.complexity <= maxComplexity);
  }
  
  if (candidates.length === 0) {
    return null;
  }
  
  // Sort by score (highest first)
  candidates.sort((a, b) => calculateScore(b) - calculateScore(a));
  
  return candidates[0];
}

module.exports = {
  listItems,
  searchItems,
  findNextItem
};
