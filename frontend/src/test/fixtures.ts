import type { BriefResponse, EvolutionResponse, MetaResponse } from '../api/client';
import briefJson from './fixtures/brief.json';
import evolutionJson from './fixtures/evolution.json';
import metaJson from './fixtures/meta.json';

export const brief = briefJson as BriefResponse;
export const evolution = evolutionJson as EvolutionResponse;
export const meta = metaJson as unknown as MetaResponse;
