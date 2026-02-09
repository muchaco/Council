/**
 * CLI prompt utilities for interactive input
 */

const readline = require('readline');

/**
 * Create readline interface
 * @returns {readline.Interface}
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt for text input
 * @param {string} question - Question to ask
 * @param {string} defaultValue - Default value
 * @returns {Promise<string>}
 */
function prompt(question, defaultValue = '') {
  const rl = createInterface();
  
  const defaultHint = defaultValue ? ` [${defaultValue}]` : '';
  
  return new Promise((resolve) => {
    rl.question(`${question}${defaultHint}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Prompt for multi-line text (description)
 * @param {string} question - Question to ask
 * @returns {Promise<string>}
 */
function promptMultiline(question) {
  const rl = createInterface();
  
  console.log(`${question} (type on multiple lines, press Ctrl+D or enter empty line twice to finish):`);
  
  const lines = [];
  let emptyLines = 0;
  
  return new Promise((resolve) => {
    rl.on('line', (line) => {
      if (line.trim() === '') {
        emptyLines++;
        if (emptyLines >= 2) {
          rl.close();
          resolve(lines.join('\n'));
        }
      } else {
        if (emptyLines > 0) {
          lines.push('');
          emptyLines = 0;
        }
        lines.push(line);
      }
    });
    
    rl.on('close', () => {
      resolve(lines.join('\n'));
    });
  });
}

/**
 * Prompt for choice from list
 * @param {string} question - Question to ask
 * @param {Array<{value: string, label: string}>} choices - Available choices
 * @param {string} defaultValue - Default value
 * @returns {Promise<string>}
 */
function promptChoice(question, choices, defaultValue) {
  const rl = createInterface();
  
  console.log(`\n${question}`);
  choices.forEach((choice, index) => {
    const isDefault = choice.value === defaultValue ? ' (default)' : '';
    console.log(`  ${index + 1}. ${choice.label}${isDefault}`);
  });
  
  return new Promise((resolve) => {
    rl.question('Enter number: ', (answer) => {
      rl.close();
      
      const num = parseInt(answer);
      if (num >= 1 && num <= choices.length) {
        resolve(choices[num - 1].value);
      } else if (!answer.trim() && defaultValue) {
        resolve(defaultValue);
      } else {
        console.log('Invalid choice, using default');
        resolve(defaultValue);
      }
    });
  });
}

/**
 * Prompt for priority
 * @returns {Promise<string>}
 */
async function promptPriority() {
  const choices = [
    { value: 'low', label: 'Low - Nice to have' },
    { value: 'medium', label: 'Medium - Should have' },
    { value: 'high', label: 'High - Important' },
    { value: 'critical', label: 'Critical - Must fix/implement' }
  ];
  
  return promptChoice('Priority?', choices, 'medium');
}

/**
 * Prompt for complexity
 * @returns {Promise<number>}
 */
async function promptComplexity() {
  const choices = [
    { value: 1, label: '1 - Trivial (minutes)' },
    { value: 2, label: '2 - Very Easy (hours)' },
    { value: 3, label: '3 - Easy (1/2 day)' },
    { value: 4, label: '4 - Moderate (1 day)' },
    { value: 5, label: '5 - Medium (2-3 days)' },
    { value: 6, label: '6 - Hard (1 week)' },
    { value: 7, label: '7 - Complex (2 weeks)' },
    { value: 8, label: '8 - Very Complex (month)' },
    { value: 9, label: '9 - Major (quarter)' },
    { value: 10, label: '10 - Epic (6+ months)' }
  ];
  
  const result = await promptChoice('Complexity (1-10)?', choices, 3);
  return result;
}

/**
 * Prompt for new requirement
 * @returns {Promise<{title: string, description: string, priority: string, complexity: number}>}
 */
async function promptRequirement() {
  console.log('\n=== Create New Requirement ===\n');
  
  const title = await prompt('Title');
  const description = await promptMultiline('Description');
  const priority = await promptPriority();
  const complexity = await promptComplexity();
  
  return { title, description, priority, complexity };
}

/**
 * Prompt for new bug
 * @returns {Promise<{title: string, description: string, priority: string, complexity: number}>}
 */
async function promptBug() {
  console.log('\n=== Create New Bug ===\n');
  
  const title = await prompt('Title');
  const description = await promptMultiline('Description (include steps to reproduce)');
  const priority = await promptPriority();
  const complexity = await promptComplexity();
  
  return { title, description, priority, complexity };
}

/**
 * Prompt for updates to existing item
 * @param {Object} item - Current item
 * @param {string} type - 'requirement' or 'bug'
 * @returns {Promise<Object>} Updated fields
 */
async function promptUpdate(item, type) {
  console.log(`\n=== Update ${type === 'requirement' ? 'Requirement' : 'Bug'} ===\n`);
  console.log(`(Press Enter to keep current value)\n`);
  
  const updates = {};
  
  const title = await prompt('Title', item.title);
  if (title !== item.title) updates.title = title;
  
  console.log('\nCurrent description:');
  console.log(item.description);
  console.log('');
  const updateDesc = await prompt('Update description? (y/n)', 'n');
  if (updateDesc.toLowerCase() === 'y') {
    const description = await promptMultiline('New description');
    if (description !== item.description) updates.description = description;
  }
  
  const priority = await promptChoice(
    'Priority?',
    [
      { value: 'low', label: `Low - Current: ${item.priority}` },
      { value: 'medium', label: `Medium - Current: ${item.priority}` },
      { value: 'high', label: `High - Current: ${item.priority}` },
      { value: 'critical', label: `Critical - Current: ${item.priority}` }
    ],
    item.priority
  );
  if (priority !== item.priority) updates.priority = priority;
  
  const complexityChoices = Array.from({ length: 10 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1} - Current: ${item.complexity}`
  }));
  const complexity = await promptChoice('Complexity?', complexityChoices, item.complexity);
  if (complexity !== item.complexity) updates.complexity = complexity;
  
  return updates;
}

module.exports = {
  prompt,
  promptMultiline,
  promptChoice,
  promptPriority,
  promptComplexity,
  promptRequirement,
  promptBug,
  promptUpdate
};
