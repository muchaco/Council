'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Edit2, Users, X, Loader2, AlertCircle, Settings } from 'lucide-react';
import { usePersonasStore } from '@/stores/personas';
import { useSettingsStore } from '@/stores/settings';
import { PERSONA_COLORS, type PersonaInput } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function PersonasPage() {
  const { personas, isLoading, fetchPersonas, createPersona, updatePersona, deletePersona } = usePersonasStore();
  const { availableModels, fetchAvailableModels, geminiApiKey } = useSettingsStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PersonaInput>({
    name: '',
    role: '',
    systemPrompt: '',
    geminiModel: '',
    temperature: 0.7,
    color: PERSONA_COLORS[0].value,
    hiddenAgenda: '',
  });

  useEffect(() => {
    fetchPersonas();
    fetchAvailableModels();
  }, [fetchPersonas, fetchAvailableModels]);

  const handleOpenForm = () => {
    setIsEditing(false);
    setEditingId(null);
    // Use first available model as default, or empty if none available
    const defaultModel = availableModels.length > 0 ? availableModels[0].name : '';
    setFormData({
      name: '',
      role: '',
      systemPrompt: '',
      geminiModel: defaultModel,
      temperature: 0.7,
      color: PERSONA_COLORS[0].value,
      hiddenAgenda: '',
    });
    setIsFormOpen(true);
  };

  const handleEditPersona = (persona: typeof personas[0]) => {
    setIsEditing(true);
    setEditingId(persona.id);
    setFormData({
      name: persona.name,
      role: persona.role,
      systemPrompt: persona.systemPrompt,
      geminiModel: persona.geminiModel,
      temperature: persona.temperature,
      color: persona.color,
      hiddenAgenda: persona.hiddenAgenda || '',
    });
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setIsEditing(false);
    setEditingId(null);
  };

  const handleInputChange = (field: keyof PersonaInput, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const isModelAvailable = (modelName: string) => {
    return availableModels.some(m => m.name === modelName);
  };

  const handleSavePersona = async () => {
    if (!formData.name || !formData.role || !formData.systemPrompt) {
      return;
    }

    // Don't save if model is unavailable (for editing existing personas)
    if (isEditing && editingId && !isModelAvailable(formData.geminiModel)) {
      return;
    }

    if (isEditing && editingId) {
      await updatePersona(editingId, formData);
    } else {
      await createPersona(formData);
    }

    handleCloseForm();
  };

  const handleDeletePersona = async () => {
    if (deleteId) {
      await deletePersona(deleteId);
      setDeleteId(null);
    }
  };

  const getColorName = (colorValue: string) => {
    return PERSONA_COLORS.find(c => c.value === colorValue)?.name || 'Custom';
  };

  return (
    <main className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-8 h-8" />
              Personas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage AI personas for your sessions
            </p>
          </div>
          <Button
            onClick={handleOpenForm}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={isLoading}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Persona
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl">
          {isLoading && personas.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : personas.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No personas yet</h3>
              <p className="text-muted-foreground mb-4">Create your first persona to start using Council</p>
              <Button onClick={handleOpenForm} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-2" />
                Create Persona
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {personas.map((persona) => (
                <Card key={persona.id} className="p-5 bg-card border-border hover:border-accent/50 transition-colors">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{persona.name}</h3>
                      <Badge variant="secondary" className="mt-1 bg-muted text-muted-foreground">
                        {persona.role}
                      </Badge>
                    </div>
                    <div 
                      className="w-8 h-8 rounded-full" 
                      style={{ backgroundColor: persona.color }}
                    />
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {persona.systemPrompt}
                  </p>

                  {/* Config */}
                  <div className="space-y-2 mb-4 pb-4 border-b border-border text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model:</span>
                      <span className="text-foreground font-mono">{persona.geminiModel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Temperature:</span>
                      <span className="text-foreground font-mono">{persona.temperature}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Color:</span>
                      <span className="text-foreground">{getColorName(persona.color)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditPersona(persona)}
                      className="flex-1"
                      disabled={isLoading}
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteId(persona.id)}
                      className="flex-1 text-destructive hover:text-destructive"
                      disabled={isLoading}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Persona' : 'Create New Persona'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Name */}
            <div>
              <label className="text-sm font-medium text-foreground">Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Strategic Advisor"
                className="mt-1 bg-input border-border text-foreground"
              />
            </div>

            {/* Role */}
            <div>
              <label className="text-sm font-medium text-foreground">Role *</label>
              <Input
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                placeholder="e.g., Visionary, Pragmatist"
                className="mt-1 bg-input border-border text-foreground"
              />
            </div>

            {/* System Prompt */}
            <div>
              <label className="text-sm font-medium text-foreground">System Prompt *</label>
              <textarea
                value={formData.systemPrompt}
                onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
                placeholder="Define this persona's personality, expertise, and approach..."
                className="mt-1 w-full px-3 py-2 bg-input border border-border rounded text-foreground text-sm resize-none"
                rows={4}
              />
            </div>

            {/* Model */}
            <div>
              <label className="text-sm font-medium text-foreground">Gemini Model</label>
              {!geminiApiKey ? (
                <div className="mt-1 w-full px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-amber-700 dark:text-amber-400 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>API key not configured. </span>
                    <Link href="/settings" className="underline font-medium hover:text-amber-800 dark:hover:text-amber-300 inline-flex items-center gap-1">
                      Go to Settings
                      <Settings className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ) : availableModels.length === 0 ? (
                <div className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded text-muted-foreground text-sm">
                  Loading available models...
                </div>
              ) : (
                <select
                  value={formData.geminiModel}
                  onChange={(e) => handleInputChange('geminiModel', e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-input border border-border rounded text-foreground text-sm"
                >
                  {/* Show unavailable model if current model is not in available list */}
                  {formData.geminiModel && !isModelAvailable(formData.geminiModel) && (
                    <option value={formData.geminiModel} disabled>
                      {formData.geminiModel} (unavailable - select a new model)
                    </option>
                  )}
                  {/* Show available models */}
                  {availableModels.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
              )}
              {formData.geminiModel && !isModelAvailable(formData.geminiModel) && (
                <div className="flex items-center gap-1 mt-1 text-xs text-amber-500">
                  <AlertCircle className="w-3 h-3" />
                  <span>This model is no longer available. Please select a different model.</span>
                </div>
              )}
            </div>

            {/* Temperature */}
            <div>
              <label className="text-sm font-medium text-foreground">Temperature</label>
              <div className="flex gap-3 items-center mt-1">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="font-mono text-sm text-foreground w-10">
                  {formData.temperature}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                0 = deterministic, 1 = balanced, 2 = creative
              </p>
            </div>

            {/* Color */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Color</label>
              <div className="grid grid-cols-5 gap-2">
                {PERSONA_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => handleInputChange('color', color.value)}
                    className={`w-full aspect-square rounded-lg border-2 transition-all ${
                      formData.color === color.value
                        ? 'border-accent scale-110'
                        : 'border-transparent hover:border-muted'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Hidden Agenda (Optional) */}
            <div>
              <label className="text-sm font-medium text-foreground">Hidden Agenda (Optional)</label>
              <textarea
                value={formData.hiddenAgenda || ''}
                onChange={(e) => handleInputChange('hiddenAgenda', e.target.value)}
                placeholder="Any hidden motivations or biases this persona has..."
                className="mt-1 w-full px-3 py-2 bg-input border border-border rounded text-foreground text-sm resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-6">
            <Button
              onClick={handleSavePersona}
              disabled={!formData.name || !formData.role || !formData.systemPrompt || isLoading || (isEditing && !isModelAvailable(formData.geminiModel))}
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Update' : 'Create'}
            </Button>
            <Button
              onClick={handleCloseForm}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Persona</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this persona? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePersona} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
