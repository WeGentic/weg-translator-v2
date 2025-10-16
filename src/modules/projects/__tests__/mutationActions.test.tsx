import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useCreateProjectAction } from "@/modules/projects/actions";

function renderHook<T>(hook: () => T) {
  let current: T | undefined;
  function TestComponent() {
    current = hook();
    return null;
  }
  render(<TestComponent />);
  if (current === undefined) {
    throw new Error("Hook did not run");
  }
  return current;
}

describe("project mutation actions", () => {
  it("throws TODO for create project action", () => {
    const hook = renderHook(() => useCreateProjectAction());
    expect(() => hook.action()).toThrow(/TODO/);
  });
});
