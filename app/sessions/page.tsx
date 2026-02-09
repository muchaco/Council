'use client';

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Clock, Loader2, Trash2, Download, MoreVertical, Archive, RotateCcw } from 'lucide-react';
import { useSessionsStore } from '@/stores/sessions';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TagDisplay } from '@/components/ui/TagDisplay';
import { useState } from 'react';

export default function SessionsPage() {
  const { sessions, isLoading, fetchSessions, deleteSession, exportSessionToMarkdown, archiveSession, unarchiveSession } = useSessionsStore();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = async () => {
    if (deleteId) {
      await deleteSession(deleteId);
      setDeleteId(null);
    }
  };

  const handleExport = async (sessionId: string) => {
    setExportingId(sessionId);
    await exportSessionToMarkdown(sessionId);
    setExportingId(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return `${diffMins}m ago`;
  };

  return (
    <main className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sessions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage your strategic summit sessions
            </p>
          </div>
          <Link to="/session/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Session
            </Button>
          </Link>
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        {isLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No sessions yet</h3>
            <p className="text-muted-foreground mb-4">Create your first session to start a strategic summit</p>
            <Link to="/session/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Session
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <Card key={session.id} className="group">
                <div className="p-4 flex flex-col gap-3">
                  {/* Title and Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/session?id=${session.id}`} className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground text-balance line-clamp-2 hover:text-primary transition-colors">
                        {session.title}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge 
                        variant={session.archivedAt ? 'secondary' : session.status === 'active' ? 'default' : session.status === 'completed' ? 'secondary' : 'outline'}
                        className="text-[10px] capitalize h-5 px-2"
                      >
                        {session.archivedAt ? 'Archived' : session.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="opacity-60 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground"
                            disabled={exportingId === session.id}
                          >
                            {exportingId === session.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MoreVertical className="w-4 h-4" />
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleExport(session.id)}>
                            <Download className="w-4 h-4 mr-2" />
                            Export to Markdown
                          </DropdownMenuItem>
                          {session.archivedAt ? (
                            <DropdownMenuItem onClick={() => unarchiveSession(session.id)}>
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Unarchive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => archiveSession(session.id)}>
                              <Archive className="w-4 h-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteId(session.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Tags - FR-1.16a: positioned adjacent to title */}
                  {session.tags && session.tags.length > 0 && (
                    <div>
                      <TagDisplay tags={session.tags} variant="readonly" />
                    </div>
                  )}

                  {/* Description */}
                  <Link to={`/session?id=${session.id}`}>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {session.problemDescription}
                    </p>
                  </Link>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(session.createdAt)}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(session.createdAt)}
                      </div>
                      <div className="flex items-center gap-1" title={`${session.tokenCount} tokens • $${session.costEstimate.toFixed(4)}`}>
                        <span className="font-mono">${session.costEstimate.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this session? All messages and data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
