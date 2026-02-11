'use client';

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, Loader2, Users, Sparkles, Crown, HelpCircle, Tag } from 'lucide-react';
import { usePersonasStore } from '@/stores/personas';
import { useSessionsStore } from '@/stores/sessions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TagInput } from '@/components/ui/TagInput';

export default function NewSessionPage() {
  const navigate = useNavigate();
  const { personas, fetchPersonas } = usePersonasStore();
  const { createSession, isLoading, allTags, fetchAllTags } = useSessionsStore();
  
  const [formData, setFormData] = useState({
    title: '',
    problemDescription: '',
    outputGoal: '',
  });
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [enableConductor, setEnableConductor] = useState(false);
  const [conductorPersonaId, setConductorPersonaId] = useState<string>('');
  const [sessionTags, setSessionTags] = useState<string[]>([]);

  useEffect(() => {
    fetchPersonas();
    fetchAllTags();
  }, [fetchPersonas, fetchAllTags]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const togglePersona = (personaId: string) => {
    setSelectedPersonas(prev => {
      if (prev.includes(personaId)) {
        // Removing a persona - reset conductor if it was this persona
        if (conductorPersonaId === personaId) {
          setConductorPersonaId('');
        }
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

    const conductorConfig = enableConductor && conductorPersonaId
      ? { enabled: true, conductorPersonaId }
      : undefined;

    const sessionId = await createSession({
      title: formData.title,
      problemDescription: formData.problemDescription,
      outputGoal: formData.outputGoal,
    }, selectedPersonas, conductorConfig, sessionTags);

    if (sessionId) {
      navigate(`/session?id=${sessionId}`);
    }
  };

  const handleAddTag = (tag: string) => {
    setSessionTags(prev => [...prev, tag]);
  };

  const handleRemoveTag = (tag: string) => {
    setSessionTags(prev => prev.filter(t => t !== tag));
  };

  const isValid = formData.title && formData.problemDescription && selectedPersonas.length >= 2;
  const canEnableConductor = selectedPersonas.length >= 2;

  return (
    <TooltipProvider>
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <Link to="/sessions">
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

                <div>
                  <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4" />
                    Tags (Optional)
                  </label>
                  <TagInput
                    tags={sessionTags}
                    allTags={allTags}
                    onAddTag={handleAddTag}
                    onRemoveTag={handleRemoveTag}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Add up to 3 tags to categorize this session
                  </p>
                </div>
              </div>
            </Card>

            {/* Conductor Mode */}
            <Card className={`p-6 bg-card border-border ${!canEnableConductor ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">Conductor Mode</h2>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-6 h-6">
                          <HelpCircle className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="text-xs">
                          The Conductor AI automatically manages turn-taking, detects topic drift,
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
                      variant={enableConductor ? "default" : "outline"}
                      onClick={() => setEnableConductor(!enableConductor)}
                      disabled={!canEnableConductor}
                      className="gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      {enableConductor ? 'Enabled' : 'Enable Conductor'}
                    </Button>
                    
                    {enableConductor && (
                      <Badge variant="secondary">
                        Will auto-manage discussion
                      </Badge>
                    )}
                  </div>
                  
                  {!canEnableConductor && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Select at least 2 personas to enable Conductor mode
                    </p>
                  )}
                </div>
              </div>

              {/* Conductor Persona Selection */}
              {enableConductor && canEnableConductor && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm font-medium text-foreground mb-3">
                    Select which persona will act as the Conductor:
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {personas
                      .filter(p => selectedPersonas.includes(p.id))
                      .map((persona) => (
                        <button
                          key={persona.id}
                      onClick={() => setConductorPersonaId(persona.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        conductorPersonaId === persona.id
                          ? 'border-primary bg-secondary'
                          : 'border-border hover:border-muted'
                      }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: persona.color }}
                            />
                            <span className="font-medium text-sm">{persona.name}</span>
                            {conductorPersonaId === persona.id && (
                              <Crown className="w-4 h-4 text-primary ml-auto" />
                            )}
                          </div>
                        </button>
                      ))}
                  </div>
                  {!conductorPersonaId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Please select one persona to be the Conductor
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
                  <Link to="/personas">
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
                          ? 'border-primary bg-secondary'
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
                          <div className="text-primary">
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
                  {enableConductor && conductorPersonaId && selectedPersonas.includes(conductorPersonaId) && (
                    <span className="text-primary ml-2">
                      • {personas.find(p => p.id === conductorPersonaId)?.name} will be Conductor
                    </span>
                  )}
                </p>
              )}
            </Card>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleCreateSession}
                disabled={!isValid || isLoading || (enableConductor && !conductorPersonaId)}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Session
              </Button>
              <Link to="/sessions">
                <Button variant="outline">Cancel</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
