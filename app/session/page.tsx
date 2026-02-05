'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Send, ArrowLeft, Loader2, Users, Clock, DollarSign, MessageSquare } from 'lucide-react';
import { useSessionsStore } from '@/stores/sessions';
import { toast } from 'sonner';

function SessionContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('id');
  
  const {
    currentSession,
    messages,
    sessionPersonas,
    isLoading,
    thinkingPersonaId,
    loadSession,
    sendUserMessage,
    triggerPersonaResponse,
    clearCurrentSession,
  } = useSessionsStore();

  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
    
    return () => {
      clearCurrentSession();
    };
  }, [sessionId, loadSession, clearCurrentSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const content = newMessage;
    setNewMessage('');
    await sendUserMessage(content);
  };

  const handleAskToSpeak = async (personaId: string) => {
    if (thinkingPersonaId) {
      toast.info('Please wait for the current response to complete');
      return;
    }
    
    await triggerPersonaResponse(personaId);
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
        <Link href="/sessions">
          <Button>Back to Sessions</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* LEFT SIDEBAR - PERSONAS */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <Link href="/sessions">
            <Button variant="ghost" size="sm" className="gap-2 mb-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            The Council
          </h2>
        </div>

        {/* Personas List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sessionPersonas.map((persona) => (
            <Card
              key={persona.id}
              className="p-3 border-border"
            >
              <div className="flex items-start gap-3 mb-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                  style={{ backgroundColor: persona.color }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground text-sm truncate">{persona.name}</h3>
                  <p className="text-xs text-muted-foreground">{persona.role}</p>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground mb-2">
                {persona.geminiModel === 'gemini-1.5-flash' ? 'Flash' : 'Pro'} • Temp: {persona.temperature}
              </div>
              
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() => handleAskToSpeak(persona.id)}
                disabled={thinkingPersonaId === persona.id || !!thinkingPersonaId}
              >
                {thinkingPersonaId === persona.id ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  'Ask to Speak'
                )}
              </Button>
            </Card>
          ))}
        </div>

        {/* Session Stats */}
        <div className="p-4 border-t border-border space-y-2 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Cost
            </span>
            <span className="font-mono">${currentSession.costEstimate.toFixed(4)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Tokens
            </span>
            <span className="font-mono">{currentSession.tokenCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Duration
            </span>
            <span className="font-mono">{formatDuration(currentSession.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* CENTER - CHAT AREA */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card p-4">
          <h2 className="text-lg font-semibold">{currentSession.title}</h2>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {currentSession.problemDescription}
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No messages yet</p>
              <p className="text-sm">Start the discussion by asking a persona to speak or sending a message</p>
            </div>
          ) : (
            messages.map((msg) => {
              const persona = sessionPersonas.find(p => p.id === msg.personaId);
              const isUser = msg.personaId === null;
              
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-medium"
                    style={{
                      backgroundColor: isUser ? '#6B7280' : persona?.color,
                    }}
                  >
                    {isUser ? 'You' : persona?.name.charAt(0)}
                  </div>
                  
                  {/* Message */}
                  <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {isUser ? 'You' : persona?.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div
                      className={`inline-block p-3 rounded-lg text-sm ${
                        isUser
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-card border border-border'
                      }`}
                    >
                      {msg.content}
                    </div>
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
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4 bg-card">
          <div className="flex gap-2">
            <Input
              placeholder="Share your thoughts with the council..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="bg-input border-border"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="bg-accent hover:bg-accent/90 text-accent-foreground flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* RIGHT SIDEBAR - INFO */}
      <div className="w-64 border-l border-border bg-card p-4 hidden lg:block">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Session Info
        </h3>
        
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <Badge 
              variant="secondary" 
              className={`
                capitalize
                ${currentSession.status === 'active' ? 'bg-emerald-500/20 text-emerald-500' : ''}
                ${currentSession.status === 'completed' ? 'bg-blue-500/20 text-blue-500' : ''}
              `}
            >
              {currentSession.status}
            </Badge>
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
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <SessionContent />
    </Suspense>
  );
}
