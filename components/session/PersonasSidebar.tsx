import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, DollarSign, MessageSquare, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PersonaListItem } from '@/components/session/PersonaListItem';
import type { Persona, Session, ConductorFlowState } from '@/lib/types';

interface SessionPersona extends Persona {
  isConductor: boolean;
  hushTurnsRemaining: number;
  hushedAt: string | null;
}

interface PersonasSidebarProps {
  currentSession: Session;
  sessionPersonas: SessionPersona[];
  isArchived: boolean;
  conductorFlowState: ConductorFlowState;
  thinkingPersonaId: string | null;
  hushPresets: readonly number[];
  onToggleConductor: () => void;
  onPauseOrResume: () => void;
  onContinue: () => void;
  onAskToSpeak: (personaId: string) => void;
  onHush: (personaId: string, turns: number) => void;
  onUnhush: (personaId: string) => void;
  formatDuration: (createdAt: string) => string;
}

export function PersonasSidebar({
  currentSession,
  sessionPersonas,
  isArchived,
  conductorFlowState,
  thinkingPersonaId,
  hushPresets,
  onToggleConductor,
  onPauseOrResume,
  onContinue,
  onAskToSpeak,
  onHush,
  onUnhush,
  formatDuration,
}: PersonasSidebarProps) {
  // Determine button state based on flow state
  const isProcessing = conductorFlowState === 'processing';
  const isAwaitingInput = conductorFlowState === 'awaiting_input';
  const isManualPaused = conductorFlowState === 'manual_paused';
  const isBlocked = conductorFlowState === 'blocked';
  const canPause = conductorFlowState === 'idle' || conductorFlowState === 'processing';
  const canResume = isManualPaused || isBlocked;
  
  return (
    <div className="flex w-64 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-4">
        <Link to="/sessions">
          <Button variant="ghost" size="sm" className="mb-2 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Conductor Mode</span>
          <Button
            variant={currentSession.conductorEnabled ? 'default' : 'outline'}
            size="sm"
            className="gap-1 text-xs"
            onClick={onToggleConductor}
            disabled={isArchived}
          >
            <Sparkles className="h-3 w-3" />
            {currentSession.conductorEnabled ? 'On' : 'Off'}
          </Button>
        </div>

        {currentSession.conductorEnabled && (
          <div className="mt-2 flex gap-1">
            {isAwaitingInput ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1 text-xs"
                disabled
              >
                <MessageSquare className="h-3 w-3" />
                Waiting...
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1 text-xs"
                onClick={onPauseOrResume}
                disabled={!canPause && !canResume}
              >
                {isManualPaused || isBlocked ? (
                  <><Play className="h-3 w-3" /> Resume</>
                ) : (
                  <><Pause className="h-3 w-3" /> Pause</>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1 text-xs"
              onClick={onContinue}
              disabled={!isBlocked}
            >
              <RotateCcw className="h-3 w-3" />
              Continue
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {sessionPersonas.map((persona) => (
          <PersonaListItem
            key={persona.id}
            persona={persona}
            isConductor={false}
            isArchived={isArchived}
            thinkingPersonaId={thinkingPersonaId}
            conductorRunning={isProcessing}
            hushPresets={hushPresets}
            onAskToSpeak={onAskToSpeak}
            onHush={onHush}
            onUnhush={onUnhush}
          />
        ))}
      </div>

      <div className="space-y-2 border-t border-border p-4 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Cost
          </span>
          <span className="font-mono">${currentSession.costEstimate.toFixed(4)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Tokens
          </span>
          <span className="font-mono">{currentSession.tokenCount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Duration
          </span>
          <span className="font-mono">{formatDuration(currentSession.createdAt)}</span>
        </div>
        {currentSession.conductorEnabled && (
          <div className="flex justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Auto-replies
            </span>
            <span className="font-mono">{currentSession.autoReplyCount}/8</span>
          </div>
        )}
      </div>
    </div>
  );
}
