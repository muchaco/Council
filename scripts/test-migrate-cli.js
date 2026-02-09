#!/usr/bin/env node

/**
 * Test migration using CLI --json flag
 * This validates the CLI create command works programmatically
 */

const { execSync } = require('child_process');
const path = require('path');

const requirements = [
  { title: "Create New Session", description: "User must be able to create a new Session with a Title, Main Problem Description, and Defined Output Goal.", priority: "critical", complexity: 2, status: "completed" },
  { title: "View Historical Sessions", description: "User must be able to view a list of historical sessions.", priority: "critical", complexity: 2, status: "completed" },
  { title: "Session Lifecycle Management", description: "User must be able to resume, pause, or delete past sessions.", priority: "high", complexity: 2, status: "completed" },
  { title: "Session State Persistence", description: "Session State must persist locally in SQLite, preserving chat history, blackboard state, and token usage.", priority: "critical", complexity: 5, status: "completed" },
  { title: "Session Archiving/Close", description: "User must be able to close/archive a session, marking it as completed. Archived sessions are read-only.", priority: "high", complexity: 2, status: "completed" },
  { title: "Session Tags", description: "User must be able to assign free-text tags to sessions for organization and filtering.", priority: "medium", complexity: 2, status: "pending" },
  { title: "Session List Filtering", description: "Sessions list must support filtering by tags, personas, status, and search by title.", priority: "medium", complexity: 5, status: "pending" },
  { title: "Export to Markdown", description: "User must be able to export any session as a Markdown file containing metadata and conversation history.", priority: "high", complexity: 2, status: "completed" },
  { title: "Create Reusable Personas", description: "User must be able to create reusable Personas with name, color, system prompt, model config, and hidden agenda.", priority: "critical", complexity: 5, status: "in-progress" },
  { title: "Temporary Personas", description: "User must be able to create temporary personas inside a session setup that are not saved to the global library.", priority: "medium", complexity: 5, status: "pending" },
  { title: "Orchestrator Algorithm (REFACTORED)", description: "The Orchestrator is an algorithmic component that manages session flow using the default LLM. Handles speaker selection, blackboard updates, and completion detection.", priority: "critical", complexity: 7, status: "pending" },
  { title: "The Hush Button", description: "User must be able to temporarily mute a Persona without removing them.", priority: "medium", complexity: 2, status: "pending" },
  { title: "The Whisper", description: "User must be able to send a private system instruction to a single Persona during a live session.", priority: "medium", complexity: 5, status: "pending" },
  { title: "Smart Turn-Taking", description: "System must avoid fixed round-robin order and intelligently select the next best speaker based on context.", priority: "critical", complexity: 9, status: "completed" },
  { title: "Shared Blackboard", description: "UI displays a State panel containing Current Consensus, Active Conflicts, and Next Immediate Step.", priority: "critical", complexity: 7, status: "completed" },
  { title: "Rolling Context", description: "To manage tokens, system summarizes older messages and feeds agents a condensed history plus blackboard state.", priority: "high", complexity: 7, status: "pending" },
  { title: "Global Attachments", description: "User can upload files (PDF/TXT/MD) to the Session. All Personas have read access.", priority: "medium", complexity: 7, status: "pending" },
  { title: "Local Attachments", description: "User can upload files to a specific Persona. Only that Persona can access them.", priority: "low", complexity: 9, status: "pending" },
  { title: "Text Extraction & Embeddings", description: "System supports text extraction and embedding with local vector store for attached files.", priority: "medium", complexity: 9, status: "pending" },
  { title: "LLM Provider Selection", description: "User can select one active LLM provider from Google Gemini, OpenRouter, or Ollama.", priority: "high", complexity: 7, status: "pending" },
  { title: "Model Assignment per Persona", description: "User can assign different models from the active provider to different Personas within the same session.", priority: "high", complexity: 5, status: "pending" },
  { title: "Cost/Token Ticker", description: "Real-time display of estimated cost (API) or Token Count (Local).", priority: "high", complexity: 2, status: "completed" },
  { title: "Visual Separation", description: "Persona avatars are clearly color-coded by Persona color.", priority: "high", complexity: 2, status: "completed" },
  { title: "Async Rendering", description: "If Orchestrator queues multiple agents, they render sequentially to prevent reading chaos.", priority: "medium", complexity: 5, status: "completed" },
  { title: "Input Field LLM Enhancement", description: "Text input fields display a star icon for LLM-powered enhancement and generation actions.", priority: "high", complexity: 7, status: "pending" },
  { title: "Message Bubble Color Accents", description: "Message bubbles display subtle accent color derived programmatically from persona color.", priority: "medium", complexity: 2, status: "completed" },
  { title: "Improved Color Picker", description: "Color picker redesigned with smaller swatches, expanded palette, and grid layout.", priority: "low", complexity: 2, status: "pending" },
  { title: "Application Icon", description: "Electron application has distinctive icon for taskbar, title bar, and application menu.", priority: "low", complexity: 2, status: "pending" },
  { title: "Performance", description: "UI must remain responsive (non-blocking) during LLM inference.", priority: "critical", complexity: 5, status: "completed" },
  { title: "Privacy", description: "All data stored locally. No external telemetry or syncing.", priority: "critical", complexity: 2, status: "completed" },
  { title: "Provider Abstraction", description: "All LLM interactions must be provider-agnostic through dependency injection pattern.", priority: "high", complexity: 7, status: "in-progress" },
  { title: "Safety/Cost Control", description: "App must have Circuit Breaker to prevent infinite loops (max 10 auto-replies before user confirm).", priority: "high", complexity: 2, status: "pending" },
  { title: "Branching/Forking Conversations", description: "Ability to branch or fork conversation threads for exploring different paths.", priority: "low", complexity: 9, status: "pending" },
  { title: "Merging Separate Sessions", description: "Combine or merge two different sessions into one.", priority: "low", complexity: 7, status: "pending" },
  { title: "Voice Input/Output", description: "Support for voice commands and audio responses.", priority: "low", complexity: 7, status: "pending" },
  { title: "Multi-User Collaboration", description: "Real-time collaboration with other human users.", priority: "low", complexity: 9, status: "pending" },
  { title: "Complex File Types", description: "Support for non-text formats like Images, Excel with macros.", priority: "low", complexity: 7, status: "pending" }
];

console.log('🧪 Testing CLI by migrating 37 requirements...\n');

let successCount = 0;
let failCount = 0;

for (const req of requirements) {
  try {
    const jsonData = JSON.stringify(req).replace(/"/g, '\\"');
    const cmd = `node scripts/requirements.js create --json "${jsonData}"`;
    
    execSync(cmd, { 
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    successCount++;
    process.stdout.write(`✓`);
  } catch (error) {
    failCount++;
    process.stdout.write(`✗`);
    console.error(`\n  Failed: ${req.title}`);
    console.error(`  Error: ${error.message}`);
  }
}

console.log(`\n\n✅ Migration Complete: ${successCount} succeeded, ${failCount} failed`);
console.log(`\nVerifying...`);

try {
  const result = execSync('npm run req -- list 2>&1 | head -20', { 
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  });
  console.log(result);
} catch (e) {
  console.log('List command output:', e.stdout);
}
