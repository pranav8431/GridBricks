import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import brief from './fixtures/brief.json';
import evolution from './fixtures/evolution.json';
import meta from './fixtures/meta.json';

/** Real API responses captured from the January 2026 snapshot. */
export const handlers = [
  http.get('*/api/v1/meta', () => HttpResponse.json(meta)),
  http.get('*/api/v1/brief', () => HttpResponse.json(brief)),
  http.get('*/api/v1/evolution', () => HttpResponse.json(evolution)),
];

export const server = setupServer(...handlers);
