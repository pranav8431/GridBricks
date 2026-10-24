import { Button, Card, Stack, Text, Title } from '@mantine/core';
import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router';

import { AppLayout } from './components/AppLayout';
import { LoadingCard } from './components/QueryState';
import { BriefPage } from './features/brief/BriefPage';

const AccuracyPage = lazy(() =>
  import('./features/accuracy/AccuracyPage').then((m) => ({ default: m.AccuracyPage })),
);
const MethodologyPage = lazy(() =>
  import('./features/methodology/MethodologyPage').then((m) => ({ default: m.MethodologyPage })),
);

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Card>
        <Stack gap="sm" align="flex-start">
          <Title order={2} fz="lg">
            Something went wrong
          </Title>
          <Text size="sm">This view hit an unexpected error. Reloading usually fixes it.</Text>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </Stack>
      </Card>
    );
  }
}

function RedirectToBrief() {
  const { search } = useLocation();
  return <Navigate to={`/brief${search}`} replace />;
}

function NotFound() {
  return (
    <Card>
      <Stack gap="sm" align="flex-start">
        <Title order={2} fz="lg">
          Page not found
        </Title>
        <Button component={Link} to="/brief" variant="light">
          Go to the day-ahead brief
        </Button>
      </Stack>
    </Card>
  );
}

const page = (element: ReactNode) => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingCard height={480} />}>{element}</Suspense>
  </ErrorBoundary>
);

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<RedirectToBrief />} />
        <Route path="brief" element={page(<BriefPage />)} />
        <Route path="accuracy" element={page(<AccuracyPage />)} />
        <Route path="methodology" element={page(<MethodologyPage />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
