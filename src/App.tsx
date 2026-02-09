import React from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import RootLayout from '@/app/layout';
import SessionsPage from '@/app/sessions/page';
import NewSessionPage from '@/app/session/new/page';
import SessionPage from '@/app/session/page';
import PersonasPage from '@/app/personas/page';
import SettingsPage from '@/app/settings/page';

function AppShell() {
  return (
    <RootLayout>
      <Outlet />
    </RootLayout>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/sessions" replace />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/session/new" element={<NewSessionPage />} />
          <Route path="/session" element={<SessionPage />} />
          <Route path="/personas" element={<PersonasPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/sessions" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
