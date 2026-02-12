import React from 'react';
import { Badge } from '@/components/ui/badge';
import { calculateAccentColor } from '@/lib/colors';

export interface MessageBubbleProps {
  content: string;
  senderName: string;
  timestamp: string;
  isUser: boolean;
  isConductor: boolean;
  isIntervention?: boolean;
  accentColor?: string;
}

export function MessageBubble({
  content,
  senderName,
  timestamp,
  isUser,
  isConductor,
  isIntervention = false,
  accentColor,
}: MessageBubbleProps) {
  const hasAccent = accentColor && !isUser && !isConductor && !isIntervention;
  const accentColors = hasAccent ? calculateAccentColor(accentColor) : null;

  const bubbleStyles: React.CSSProperties = hasAccent && accentColors
    ? {
        borderLeft: `3px solid ${accentColors.border}`,
        backgroundColor: accentColors.background,
      }
    : {};

  const bubbleClassName = (() => {
    if (isUser && isConductor) {
      return 'bg-primary/90 text-primary-foreground border border-primary/40';
    }
    if (isUser) {
      return 'bg-primary text-primary-foreground';
    }
    if (isIntervention) {
      return 'bg-secondary border';
    }
    if (hasAccent) {
      return 'border';
    }
    return 'bg-card border';
  })();

  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium">{senderName}</span>
        {isIntervention && (
          <Badge variant="outline" className="text-xs">
            Intervention
          </Badge>
        )}
        {isConductor && (
          <Badge variant="secondary" className="text-xs">
            Conductor
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div
        className={`inline-block p-3 rounded-lg text-sm ${bubbleClassName}`}
        style={bubbleStyles}
        data-testid="message-bubble"
      >
        {content}
      </div>
    </div>
  );
}
