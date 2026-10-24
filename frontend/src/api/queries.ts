import { keepPreviousData, QueryClient, useQuery } from '@tanstack/react-query';

import { api, ApiError, unwrap, type GateId } from './client';

export interface GateSelection {
  gate: GateId;
  /** Custom decision time (HH:MM, UK) that overrides the gate's closure. */
  cutoff: string | undefined;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The pilot's data is a fixed historical snapshot, so nothing ever goes stale.
        staleTime: Infinity,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failures, error) =>
          failures < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
    },
  });
}

const gateQuery = ({ gate, cutoff }: GateSelection) => ({ gate, cutoff: cutoff ?? null });

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: ({ signal }) => unwrap(api.GET('/api/v1/meta', { signal })),
  });
}

export function useBrief(decisionDate: string | undefined, selection: GateSelection) {
  return useQuery({
    queryKey: ['brief', decisionDate, selection.gate, selection.cutoff ?? null],
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/api/v1/brief', {
          params: { query: { decision_date: decisionDate ?? '', ...gateQuery(selection) } },
          signal,
        }),
      ),
    enabled: decisionDate !== undefined,
    placeholderData: keepPreviousData,
  });
}

export function useEvolution(decisionDate: string | undefined, selection: GateSelection) {
  return useQuery({
    queryKey: ['evolution', decisionDate, selection.gate, selection.cutoff ?? null],
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/api/v1/evolution', {
          params: { query: { decision_date: decisionDate ?? '', ...gateQuery(selection) } },
          signal,
        }),
      ),
    enabled: decisionDate !== undefined,
    placeholderData: keepPreviousData,
  });
}

export function useAccuracy(
  selection: GateSelection,
  decisionFrom: string | undefined,
  decisionTo: string | undefined,
) {
  return useQuery({
    queryKey: ['accuracy', selection.gate, selection.cutoff ?? null, decisionFrom, decisionTo],
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/api/v1/accuracy', {
          params: {
            query: {
              ...gateQuery(selection),
              decision_from: decisionFrom ?? null,
              decision_to: decisionTo ?? null,
            },
          },
          signal,
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useHorizon(selection: GateSelection) {
  return useQuery({
    queryKey: ['horizon', selection.gate, selection.cutoff ?? null],
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/api/v1/accuracy/horizon', { params: { query: gateQuery(selection) }, signal }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useQuality() {
  return useQuery({
    queryKey: ['quality'],
    queryFn: ({ signal }) => unwrap(api.GET('/api/v1/quality', { signal })),
  });
}
