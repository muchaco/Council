import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, ArrowRight, Lightbulb, ScrollText } from 'lucide-react';
import type { BlackboardState } from '@/lib/types';

interface BlackboardPanelProps {
  blackboard: BlackboardState | null;
}

export function BlackboardPanel({ blackboard }: BlackboardPanelProps) {
  const hasContent = blackboard && (
    blackboard.consensus || 
    blackboard.conflicts || 
    blackboard.nextStep || 
    blackboard.facts
  );

  if (!hasContent) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ScrollText className="w-4 h-4" />
            Blackboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            The Blackboard will display consensus, conflicts, and next steps as the discussion progresses.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <ScrollText className="w-4 h-4" />
          Blackboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Consensus */}
        {blackboard?.consensus && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">Consensus</span>
            </div>
            <p className="text-xs text-muted-foreground pl-5">{blackboard.consensus}</p>
          </div>
        )}

        {/* Conflicts */}
        {blackboard?.conflicts && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3 h-3 text-red-500" />
              <span className="text-xs font-medium text-red-600">Active Conflicts</span>
            </div>
            <p className="text-xs text-muted-foreground pl-5">{blackboard.conflicts}</p>
          </div>
        )}

        {/* Next Step */}
        {blackboard?.nextStep && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ArrowRight className="w-3 h-3 text-blue-500" />
              <span className="text-xs font-medium text-blue-600">Next Step</span>
            </div>
            <p className="text-xs text-muted-foreground pl-5">{blackboard.nextStep}</p>
          </div>
        )}

        {/* Key Facts */}
        {blackboard?.facts && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-3 h-3 text-amber-500" />
              <span className="text-xs font-medium text-amber-600">Key Facts</span>
            </div>
            <p className="text-xs text-muted-foreground pl-5">{blackboard.facts}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
