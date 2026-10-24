import createClient from 'openapi-fetch';

import type { components, paths } from './schema';

type Schemas = components['schemas'];
export type GateId = Schemas['GateId'];
export type GateInfo = Schemas['GateInfo'];
export type RunInfo = Schemas['RunInfo'];
export type SeriesPoint = Schemas['SeriesPoint'];
export type BriefResponse = Schemas['BriefResponse'];
export type BriefHour = Schemas['BriefHour'];
export type EvolutionResponse = Schemas['EvolutionResponse'];
export type EvolutionRun = Schemas['EvolutionRun'];
export type AccuracyResponse = Schemas['AccuracyResponse'];
export type MetricSet = Schemas['MetricSet'];
export type DailyAccuracy = Schemas['DailyAccuracy'];
export type GateComparison = Schemas['GateComparison'];
export type HorizonResponse = Schemas['HorizonResponse'];
export type QualityResponse = Schemas['QualityResponse'];
export type MetaResponse = Schemas['MetaResponse'];

/** Same origin in every environment: Vite proxies /api in dev, FastAPI or Vercel serve it in prod. */
export const api = createClient<paths>({
  baseUrl: typeof window === 'undefined' ? '' : window.location.origin,
  // Resolve fetch per call rather than at import, so instrumentation and test mocks apply.
  fetch: (request: Request) => globalThis.fetch(request),
});

export class ApiError extends Error {
  readonly status: number;
  readonly title: string;

  constructor(status: number, title: string, detail: string) {
    super(detail || title);
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
  }
}

interface Problem {
  title?: string;
  detail?: string;
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Turns openapi-fetch results into data or a typed error, using the API's problem+json body. */
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await request;
  } catch {
    throw new ApiError(0, 'Network error', 'Could not reach the GridBricks API. Please retry.');
  }
  const { data, error, response } = result;
  if (error !== undefined || data === undefined) {
    const problem: Problem = typeof error === 'object' && error !== null ? error : {};
    throw new ApiError(
      response.status,
      problem.title ?? (response.statusText || 'Request failed'),
      problem.detail ?? '',
    );
  }
  return data;
}

export function briefCsvUrl(decisionDate: string, gate: GateId, cutoff?: string): string {
  const query = new URLSearchParams({ decision_date: decisionDate, gate });
  if (cutoff) query.set('cutoff', cutoff);
  return `/api/v1/brief.csv?${query.toString()}`;
}
