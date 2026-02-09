import React from 'react';
import { Toaster } from 'sonner';
import { SidebarNav } from '@/components/sidebar-nav';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="dark font-sans antialiased bg-background text-foreground flex h-screen overflow-hidden">
      <SidebarNav />
      {children}
      <Toaster position="bottom-right" />
    </div>
  );
}
