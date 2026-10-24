import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { accuracy, brief, evolution, horizon, meta, quality } from './fixtures';

export const handlers = [
  http.get('*/api/v1/meta', () => HttpResponse.json(meta)),
  http.get('*/api/v1/brief', () => HttpResponse.json(brief)),
  http.get('*/api/v1/evolution', () => HttpResponse.json(evolution)),
  http.get('*/api/v1/accuracy', () => HttpResponse.json(accuracy)),
  http.get('*/api/v1/accuracy/horizon', () => HttpResponse.json(horizon)),
  http.get('*/api/v1/quality', () => HttpResponse.json(quality)),
];

export const server = setupServer(...handlers);
