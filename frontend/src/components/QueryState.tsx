import { Alert, Button, Card, Group, Skeleton, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ApiError } from '../api/client';

export function LoadingCard({ height = 320 }: { height?: number }) {
  return (
    <Card aria-busy="true" aria-label="Loading">
      <Stack gap="sm">
        <Skeleton height={16} width="40%" />
        <Skeleton height={height} />
      </Stack>
    </Card>
  );
}

export function ErrorCard({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const title = error instanceof ApiError ? error.title : 'Something went wrong';
  const message = error instanceof Error ? error.message : 'Unexpected error.';
  return (
    <Alert
      variant="light"
      color="red"
      title={title}
      icon={<IconAlertTriangle size={18} />}
      role="alert"
    >
      <Group justify="space-between" align="center" gap="sm">
        <Text size="sm">{message}</Text>
        {onRetry ? (
          <Button size="xs" variant="default" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </Group>
    </Alert>
  );
}

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  loadingHeight?: number;
  children: (data: T, refetching: boolean) => ReactNode;
}

/** First load shows a skeleton; refetches keep the previous render (dimmed) to avoid layout jumps. */
export function QueryState<T>({ query, loadingHeight, children }: QueryStateProps<T>) {
  if (query.data !== undefined) {
    return <>{children(query.data, query.isFetching && query.isPlaceholderData)}</>;
  }
  if (query.isError) {
    return <ErrorCard error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <LoadingCard height={loadingHeight} />;
}
