'use client';

import { Link, useLocation } from 'react-router-dom';
import { Settings, Users, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function SidebarNav() {
  const { pathname } = useLocation();

  const items = [
    {
      title: 'Sessions',
      href: '/sessions',
      icon: Folder,
    },
    {
      title: 'Personas',
      href: '/personas',
      icon: Users,
    },
    {
      title: 'Settings',
      href: '/settings',
      icon: Settings,
    },
  ];

  return (
    <nav className="w-56 border-r border-border bg-card flex flex-col h-screen">
      {/* Navigation Items */}
      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} to={item.href}>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                )}
              >
                <Icon className="w-4 h-4 mr-2" />
                {item.title}
              </Button>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border text-xs text-muted-foreground">
        <p>v0.1.0</p>
      </div>
    </nav>
  );
}
