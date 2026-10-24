import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom lacks these browser APIs, which Mantine and the chart wrapper rely on.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub;
window.HTMLElement.prototype.scrollIntoView = () => {};

// jsdom swaps in its own AbortController, but Node's fetch only accepts native AbortSignals.
// Tests do not need request cancellation, so the test environment drops the signal.
const NativeRequest = globalThis.Request;
globalThis.Request = class extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init ? { ...init, signal: undefined } : init);
  }
};

afterEach(() => {
  cleanup();
});
