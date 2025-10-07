import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

if (typeof window !== "undefined" && window.matchMedia == null) {
  const createMatchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn(createMatchMedia),
  });
}

export * from "../utils/providers";
