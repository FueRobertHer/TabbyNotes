import { describe, expect, it } from "vitest";

import { countWords, formatEdited } from "./format";

describe("countWords", () => {
  it("counts words but not Markdown punctuation", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("# Title\n\n- [ ] don't forget **milk**\n> quote | 42\n---")).toBe(6);
  });
});

describe("formatEdited", () => {
  const now = new Date(2026, 8, 25, 12, 0).getTime();

  it.each([
    [now - 10_000, "just now"],
    [now - 5 * 60_000, "5 min. ago"],
    [now - 3 * 3_600_000, "3 hr. ago"],
    [now - 30 * 3_600_000, "yesterday"],
    [new Date(2026, 1, 3).getTime(), "Feb 3"],
    [new Date(2024, 1, 3).getTime(), "Feb 3, 2024"],
  ])("formats %s", (timestamp, expected) => {
    expect(formatEdited(timestamp, now, "en-US")).toBe(expected);
  });
});
