import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans-condensed/600.css';
import '@fontsource/ibm-plex-sans-condensed/700.css';
import './index.css';
import { Layout } from './components/Layout.tsx';
import { ToastProvider } from './components/ui.tsx';
import { JobsPage } from './pages/JobsPage.tsx';
import { LeadDetailPage } from './pages/LeadDetailPage.tsx';
import { LeadsPage } from './pages/LeadsPage.tsx';
import { OnboardingPage } from './pages/OnboardingPage.tsx';
import { SearchPage } from './pages/SearchPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, retry: 1, refetchOnWindowFocus: true },
  },
});

const router = createBrowserRouter([
  { path: '/willkommen', element: <OnboardingPage /> },
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/leads" replace /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'leads/:id', element: <LeadDetailPage /> },
      { path: 'suche', element: <SearchPage /> },
      { path: 'suchlaeufe', element: <JobsPage /> },
      { path: 'einstellungen', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/leads" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
