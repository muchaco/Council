'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, Loader2, Users, Sparkles, Crown, HelpCircle } from 'lucide-react';
import { usePersonasStore } from '@/stores/personas';
import { useSessionsStore } from '@/stores/sessions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';

export default function NewSessionPage() {
  const router = useRouter();
  const { personas, fetchPersonas } = usePersonasStore();
  const { createSession, isLoading } = useSessionsStore();
  
  const [formData, setFormData] = useState({
    title: '',
    problemDescription: '',
    outputGoal: '',
  });
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [enableOrchestrator, setEnableOrchestrator] = useState(false);
  const [orchestratorPersonaId, setOrchestratorPersonaId] = useState<string>('');

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  useEffect(() => {
    // Reset orchestrator selection when selected personas change
    if (!selectedPersonas.includes(orchestratorPersonaId)) {
      setOrchestratorPersonaId('');
    }
  }, [selectedPersonas, orchestratorPersonaId]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const togglePersona = (personaId: string) => {
    setSelectedPersonas(prev => {
      if (prev.includes(personaId)) {
        return prev.filter(id => id !== personaId);
      }
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, personaId];
    });
  };

  const handleCreateSession = async () => {
    if (!formData.title || !formData.problemDescription || selectedPersonas.length < 2) {
      return;
    }

    const orchestratorConfig = enableOrchestrator && orchestratorPersonaId
      ? { enabled: true, orchestratorPersonaId }
      : undefined;

    const sessionId = await createSession({
      title: formData.title,
      problemDescription: formData.problemDescription,
      outputGoal: formData.outputGoal,
    }, selectedPersonas, orchestratorConfig);

    if (sessionId) {
      router.push(`/session?id=${sessionId}`);
    }
  };

  const isValid = formData.title && formData.problemDescription && selectedPersonas.length >= 2;
  const canEnableOrchestrator = selectedPersonas.length >= 2;

  return (
    <TooltipProvider>
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <Link href="/sessions">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <Plus className="w-8 h-8" />
                New Session
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Create a new strategic summit session
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Session Details */}
            <Card className="p-6 bg-card border-border">
              <h2 className="text-lg font-semibold text-foreground mb-4">Session Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Title *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="e.g., Q1 Product Strategy"
                    className="mt-1 bg-input border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Problem Description *</label>
                  <textarea
                    value={formData.problemDescription}
                    onChange={(e) => handleInputChange('problemDescription', e.target.value)}
                    placeholder="Describe the problem or challenge you want the council to address..."
                    className="mt-1 w-full px-3 py-2 bg-input border border-border rounded text-foreground text-sm resize-none"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Output Goal (Optional)</label>
                  <Input
                    value={formData.outputGoal}
                    onChange={(e) => handleInputChange('outputGoal', e.target.value)}
                    placeholder="e.g., A 3-month action plan with budget estimates"
                    className="mt-1 bg-input border-border text-foreground"
                  />
                </div>
              </div>
            </Card>

            {/* Orchestrator Mode */}
            <Card className={`p-6 bg-card border-border ${!canEnableOrchestrator ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-semibold text-foreground">Orchestrator Mode</h2>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-6 h-6">
                          <HelpCircle className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="text-xs">
                          The Orchestrator AI automatically manages turn-taking, detects topic drift, 
                          and maintains a shared Blackboard of consensus and conflicts. Requires at least 2 personas.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enable AI-powered orchestration to automatically manage the discussion flow
                  </p>
                  
                  <div className="flex items-center gap-3">
                    <Button
                      variant={enableOrchestrator ? "default" : "outline"}
                      onClick={() => setEnableOrchestrator(!enableOrchestrator)}
                      disabled={!canEnableOrchestrator}
                      className="gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      {enableOrchestrator ? 'Enabled' : 'Enable Orchestrator'}
                    </Button>
                    
                    {enableOrchestrator && (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                        Will auto-manage discussion
                      </Badge>
                    )}
                  </div>
                  
                  {!canEnableOrchestrator && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Select at least 2 personas to enable Orchestrator mode
                    </p>
                  )}
                </div>
              </div>

              {/* Orchestrator Persona Selection */}
              {enableOrchestrator && canEnableOrchestrator && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm font-medium text-foreground mb-3">
                    Select which persona will act as the Orchestrator:
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {personas
                      .filter(p => selectedPersonas.includes(p.id))
                      .map((persona) => (
                        <button
                          key={persona.id}
                          onClick={() => setOrchestratorPersonaId(persona.id)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            orchestratorPersonaId === persona.id
                              ? 'border-amber-500 bg-amber-500/10'
                              : 'border-border hover:border-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: persona.color }}
                            />
                            <span className="font-medium text-sm">{persona.name}</span>
                            {orchestratorPersonaId === persona.id && (
                              <Crown className="w-4 h-4 text-amber-500 ml-auto" />
                            )}
                          </div>
                        </button>
                      ))}
                  </div>
                  {!orchestratorPersonaId && (
                    <p className="text-xs text-amber-600 mt-2">
                      Please select one persona to be the Orchestrator
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* Persona Selection */}
            <Card className="p-6 bg-card border-border">
              <h2 className="text-lg font-semibold text-foreground mb-2">Select Personas *</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Choose at least 2 personas for your council (max 4)
              </p>
              
              {personas.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-lg">
                  <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No personas available</p>
                  <Link href="/personas">
                    <Button variant="link" className="mt-2">
                      Create personas first
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {personas.map((persona) => (
                    <button
                      key={persona.id}
                      onClick={() => togglePersona(persona.id)}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        selectedPersonas.includes(persona.id)
                          ? 'border-accent bg-accent/10'
                          : 'border-border hover:border-muted'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: persona.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground text-sm">{persona.name}</h3>
                          <p className="text-xs text-muted-foreground">{persona.role}</p>
                        </div>
                        {selectedPersonas.includes(persona.id) && (
                          <div className="text-accent">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {selectedPersonas.length > 0 && (
                <p className="text-sm text-muted-foreground mt-3">
                  {selectedPersonas.length} persona{selectedPersonas.length !== 1 ? 's' : ''} selected
                  {enableOrchestrator && orchestratorPersonaId && selectedPersonas.includes(orchestratorPersonaId) && (
                    <span className="text-amber-600 ml-2">
                      • {personas.find(p => p.id === orchestratorPersonaId)?.name} will be Orchestrator
                    </span>
                  )}
                </p>
              )}
            </Card>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleCreateSession}
                disabled={!isValid || isLoading || (enableOrchestrator && !orchestratorPersonaId)}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Session
              </Button>
              <Link href="/sessions">
                <Button variant="outline">Cancel</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
