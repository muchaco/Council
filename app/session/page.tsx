'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Send,
  Loader2,
  Users,
  Clock,
  DollarSign,
  MessageSquare,
  Crown,
  Sparkles,
  Download,
  Archive,
  RotateCcw as Unarchive,
  Tag,
} from 'lucide-react';
import { useSessionsStore } from '@/stores/sessions';
import { BlackboardPanel } from '@/components/blackboard/BlackboardPanel';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { PersonasSidebar } from '@/components/session/PersonasSidebar';
import { TagDisplay } from '@/components/ui/TagDisplay';
import { TagInput } from '@/components/ui/TagInput';
import { toast } from 'sonner';

function SessionContent() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('id');
  
  const {
    currentSession,
    messages,
    sessionPersonas,
    isLoading,
    thinkingPersonaId,
    orchestratorRunning,
    orchestratorPaused,
    blackboard,
    allTags,
    loadSession,
    sendUserMessage,
    triggerPersonaResponse,
    enableOrchestrator,
    disableOrchestrator,
    processOrchestratorTurn,
    pauseOrchestrator,
    resumeOrchestrator,
    resetCircuitBreaker,
    clearCurrentSession,
    exportSessionToMarkdown,
    archiveSession,
    unarchiveSession,
    hushPersona,
    unhushPersona,
    fetchAllTags,
    addTagToSession,
    removeTagFromSession,
  } = useSessionsStore();

  const [newMessage, setNewMessage] = useState('');
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isArchived = currentSession?.archivedAt !== null;

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
      fetchAllTags();
    }
    
    return () => {
      clearCurrentSession();
    };
  }, [sessionId, loadSession, clearCurrentSession, fetchAllTags]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const content = newMessage;
    setNewMessage('');
    await sendUserMessage(content);
    
    // If orchestrator is enabled and not paused, trigger it
    if (currentSession?.orchestratorEnabled && !orchestratorPaused) {
      processOrchestratorTurn();
    }
  };

  const handleAskToSpeak = async (personaId: string) => {
    if (thinkingPersonaId) {
      toast.info('Please wait for the current response to complete');
      return;
    }
    
    await triggerPersonaResponse(personaId);
    
    // If orchestrator is enabled and not paused, trigger it after response
    if (currentSession?.orchestratorEnabled && !orchestratorPaused) {
      setTimeout(() => processOrchestratorTurn(), 1000);
    }
  };

  // Hush button handlers - "The Hush Button" feature
  const HUSH_PRESETS = [1, 3, 5, 10];
  
  const handleHushPersona = async (personaId: string, turns: number) => {
    if (!currentSession) return;
    await hushPersona(personaId, turns);
  };

  const handleUnhushPersona = async (personaId: string) => {
    if (!currentSession) return;
    await unhushPersona(personaId);
  };

  const handleOrchestratorToggle = async () => {
    if (!currentSession) return;
    
    if (currentSession.orchestratorEnabled) {
      await disableOrchestrator();
    } else {
      // Find first non-orchestrator persona to be the orchestrator
      const nonOrchestratorPersonas = sessionPersonas.filter(p => !p.isOrchestrator);
      if (nonOrchestratorPersonas.length === 0) {
        toast.error('Need at least one non-orchestrator persona');
        return;
      }
      // For simplicity, use the first persona as orchestrator
      await enableOrchestrator(nonOrchestratorPersonas[0].id);
    }
  };

  const handleAddTag = async (tagName: string) => {
    if (!currentSession) return;
    await addTagToSession(currentSession.id, tagName);
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!currentSession) return;
    await removeTagFromSession(currentSession.id, tagName);
  };

  const formatDuration = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  };

  if (isLoading && !currentSession) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Session not found</p>
        <Link to="/sessions">
          <Button>Back to Sessions</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* LEFT SIDEBAR - PERSONAS */}
      <PersonasSidebar
        currentSession={currentSession}
        sessionPersonas={sessionPersonas}
        isArchived={isArchived}
        orchestratorPaused={orchestratorPaused}
        orchestratorRunning={orchestratorRunning}
        thinkingPersonaId={thinkingPersonaId}
        hushPresets={HUSH_PRESETS}
        onToggleOrchestrator={handleOrchestratorToggle}
        onPauseOrResume={orchestratorPaused ? resumeOrchestrator : pauseOrchestrator}
        onContinue={resetCircuitBreaker}
        onAskToSpeak={handleAskToSpeak}
        onHush={handleHushPersona}
        onUnhush={handleUnhushPersona}
        formatDuration={formatDuration}
      />

      {/* CENTER - CHAT AREA */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold">{currentSession.title}</h2>
              
              {/* Tags - FR-1.16a: positioned adjacent to title */}
              <div className="mt-1">
                {isArchived ? (
                  <TagDisplay 
                    tags={currentSession.tags || []} 
                    variant="readonly" 
                  />
                ) : (
                  <TagInput
                    tags={currentSession.tags || []}
                    allTags={allTags}
                    onAddTag={handleAddTag}
                    onRemoveTag={handleRemoveTag}
                    disabled={isArchived}
                  />
                )}
              </div>
              
              <p className="text-xs text-muted-foreground line-clamp-1 mt-2">
                {currentSession.problemDescription}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportSessionToMarkdown(currentSession.id)}
                disabled={messages.length === 0}
                className="gap-1"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
              {isArchived ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unarchiveSession(currentSession.id)}
                  className="gap-1"
                >
                  <Unarchive className="w-4 h-4" />
                  Unarchive
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowArchiveConfirm(true)}
                  disabled={messages.length === 0}
                  className="gap-1"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No messages yet</p>
              <p className="text-sm">
                {currentSession.orchestratorEnabled 
                  ? 'Send a message or the Orchestrator will guide the discussion'
                  : 'Start the discussion by asking a persona to speak or sending a message'
                }
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const persona = sessionPersonas.find(p => p.id === msg.personaId);
              const isUser = msg.personaId === null;
              const isIntervention = msg.metadata?.isIntervention;
              const isOrchestratorMessage = msg.metadata?.isOrchestratorMessage || 
                (persona?.id === currentSession.orchestratorPersonaId);
              
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-primary-foreground text-xs font-medium ${
                      isOrchestratorMessage ? 'ring-2 ring-primary' : ''
                    }`}
                    style={{
                      backgroundColor: isUser ? 'var(--muted-foreground)' : persona?.color,
                    }}
                  >
                    {isUser ? 'You' : isOrchestratorMessage ? <Crown className="w-4 h-4" /> : persona?.name.charAt(0)}
                  </div>
                  
                  {/* Message */}
                  <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
                    <MessageBubble
                      content={msg.content}
                      senderName={isUser ? 'You' : persona?.name || 'Unknown'}
                      timestamp={msg.createdAt}
                      isUser={isUser}
                      isOrchestrator={isOrchestratorMessage}
                      isIntervention={isIntervention}
                      accentColor={persona?.color}
                    />
                  </div>
                </div>
              );
            })
          )}
          
          {/* Thinking indicator */}
          {thinkingPersonaId && (
            <div className="flex gap-3">
              {(() => {
                const persona = sessionPersonas.find(p => p.id === thinkingPersonaId);
                return (
                  <>
                    <div
                      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-medium animate-pulse"
                      style={{ backgroundColor: persona?.color }}
                    >
                      {persona?.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{persona?.name}</span>
                        <span className="text-xs text-muted-foreground">Thinking...</span>
                      </div>
                      <div className="inline-block p-3 rounded-lg text-sm bg-card border border-border">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          
            {/* Orchestrator thinking indicator */}
            {orchestratorRunning && !thinkingPersonaId && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-primary-foreground text-xs font-medium bg-primary animate-pulse">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">Orchestrator</span>
                    <span className="text-xs text-muted-foreground">Selecting next speaker...</span>
                  </div>
                  <div className="inline-block p-3 rounded-lg text-sm bg-secondary border">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4 bg-card">
          {isArchived ? (
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground">
                This session is archived. You can view the conversation but cannot add new messages.
              </p>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  placeholder={currentSession.orchestratorEnabled 
                    ? "Share your thoughts or let the Orchestrator guide the discussion..."
                    : "Share your thoughts with the council..."
                  }
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="bg-input border-border"
                  disabled={orchestratorRunning}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || orchestratorRunning}
                  className="flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send, Shift+Enter for new line
                {currentSession.orchestratorEnabled && orchestratorPaused && (
                  <span className="ml-2 text-primary">• Orchestrator paused - click Resume or Continue to proceed</span>
                )}
              </p>
            </>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR - INFO & BLACKBOARD */}
      <div className="w-80 border-l border-border bg-card hidden lg:flex lg:flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Session Info */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Session Info
            </h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Badge 
                  variant={isArchived ? 'secondary' : currentSession.status === 'active' ? 'default' : 'secondary'}
                  className="capitalize"
                >
                  {isArchived ? 'Archived' : currentSession.status}
                </Badge>
                {isArchived && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(currentSession.archivedAt!).toLocaleDateString()}
                  </p>
                )}
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-1">Goal</p>
                <p className="text-sm text-foreground">
                  {currentSession.outputGoal || 'No specific goal set'}
                </p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-1">Participants</p>
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  <span className="text-sm">{sessionPersonas.length} personas</span>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-1">Messages</p>
                <span className="text-sm font-mono">{messages.length}</span>
              </div>
            </div>
          </div>

          {/* Blackboard Panel */}
          <BlackboardPanel blackboard={blackboard || currentSession.blackboard} />
        </div>
      </div>

      {/* Archive Confirmation Dialog */}
      <Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Session?</DialogTitle>
            <DialogDescription>
              This will archive the session and make it read-only. You will not be able to add new messages or make changes. You can unarchive the session at any time from the sessions list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              archiveSession(currentSession.id);
              setShowArchiveConfirm(false);
            }}>
              Archive Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SessionPage() {
  return <SessionContent />;
}
