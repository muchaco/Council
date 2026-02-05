'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Users, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function SidebarNav() {
  const pathname = usePathname();

  const items = [
    {
      title: 'Sessions',
      href: '/',
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
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold text-accent">Council</h1>
        <p className="text-xs text-muted-foreground mt-1">Strategic Summit</p>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  isActive && 'bg-accent text-accent-foreground',
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
