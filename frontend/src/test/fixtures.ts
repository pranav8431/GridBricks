import type {
  AccuracyResponse,
  BriefResponse,
  EvolutionResponse,
  HorizonResponse,
  MetaResponse,
  QualityResponse,
} from '../api/client';
import accuracyJson from './fixtures/accuracy.json';
import briefJson from './fixtures/brief.json';
import evolutionJson from './fixtures/evolution.json';
import horizonJson from './fixtures/horizon.json';
import metaJson from './fixtures/meta.json';
import qualityJson from './fixtures/quality.json';

/** Real API responses captured from the January 2026 snapshot. */
export const brief = briefJson as BriefResponse;
export const evolution = evolutionJson as EvolutionResponse;
export const meta = metaJson as unknown as MetaResponse;
export const accuracy = accuracyJson as unknown as AccuracyResponse;
export const horizon = horizonJson as HorizonResponse;
export const quality = qualityJson as unknown as QualityResponse;
