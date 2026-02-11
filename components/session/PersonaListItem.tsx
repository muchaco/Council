import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Crown, Loader2, Volume2, VolumeX } from 'lucide-react';
import type { Persona } from '@/lib/types';

interface SessionPersona extends Persona {
  isConductor: boolean;
  hushTurnsRemaining: number;
  hushedAt: string | null;
}

interface PersonaListItemProps {
  persona: SessionPersona;
  isConductor: boolean;
  isArchived: boolean;
  thinkingPersonaId: string | null;
  conductorRunning: boolean;
  hushPresets: readonly number[];
  onAskToSpeak: (personaId: string) => void;
  onHush: (personaId: string, turns: number) => void;
  onUnhush: (personaId: string) => void;
}

export function PersonaListItem({
  persona,
  isConductor,
  isArchived,
  thinkingPersonaId,
  conductorRunning,
  hushPresets,
  onAskToSpeak,
  onHush,
  onUnhush,
}: PersonaListItemProps) {
  const isThinking = thinkingPersonaId === persona.id;
  const hasThinkingPersona = thinkingPersonaId !== null;
  const isHushed = persona.hushTurnsRemaining > 0;
  const modelTier = persona.geminiModel.toLowerCase().includes('flash') ? 'Flash' : 'Pro';

  return (
    <div
      className={`rounded-md border border-border/70 px-2.5 py-2 ${isConductor ? 'border-primary/50 bg-primary/5' : 'bg-card/60'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: persona.color }}
            />
            <span className="truncate text-sm font-medium text-foreground">{persona.name}</span>
            {isConductor && <Crown className="h-3 w-3 shrink-0 text-primary" />}
          </div>
          <p className="truncate pl-4 text-xs text-muted-foreground">{persona.role}</p>
        </div>

        {isHushed && (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Hushed {persona.hushTurnsRemaining}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 pl-4">
        <span className="text-[11px] text-muted-foreground">
          {modelTier} - Temp: {persona.temperature}
        </span>

        {!isArchived && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onAskToSpeak(persona.id)}
              disabled={isThinking || hasThinkingPersona || conductorRunning || isArchived || isHushed}
            >
              {isThinking ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking...
                </>
              ) : isHushed ? (
                <>
                  <VolumeX className="h-3 w-3" />
                  Hushed
                </>
              ) : (
                'Ask'
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={isThinking || conductorRunning}
                >
                  {isHushed ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isHushed ? (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Hushed for {persona.hushTurnsRemaining} turn{persona.hushTurnsRemaining === 1 ? '' : 's'}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onUnhush(persona.id)}>
                      <Volume2 className="h-4 w-4" />
                      Unhush
                    </DropdownMenuItem>
                  </>
                ) : (
                  hushPresets.map((turns) => (
                    <DropdownMenuItem key={turns} onClick={() => onHush(persona.id, turns)}>
                      <VolumeX className="h-4 w-4" />
                      Hush {turns}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}
