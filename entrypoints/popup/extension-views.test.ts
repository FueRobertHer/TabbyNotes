import { afterEach, describe, expect, it, vi } from "vitest";
import { browser } from "wxt/browser";

import { openStandaloneWindow, openStandaloneWindowId } from "./extension-views";

function fakeView(view: string | undefined, tabbyWindowId?: number): Window {
  return {
    document: { documentElement: { dataset: view ? { view } : {} } },
    ...(tabbyWindowId === undefined ? {} : { tabbyWindowId }),
  } as unknown as Window;
}

function stubViews(views: Window[]) {
  const extension = browser.extension as unknown as { getViews: () => Window[] };
  extension.getViews = vi.fn(() => views);
}

describe("standalone window lookup", () => {
  afterEach(() => vi.restoreAllMocks());

  it("finds the open standalone window among the extension's pages", () => {
    stubViews([fakeView(undefined), fakeView("sidebar", 3), fakeView("window", 7)]);
    expect(openStandaloneWindowId()).toBe(7);
  });

  it("ignores a standalone page that hasn't registered its window yet, and this page itself", () => {
    stubViews([fakeView("window"), window]);
    expect(openStandaloneWindowId()).toBeUndefined();
  });

  it("focuses the existing window instead of opening a second one", async () => {
    stubViews([fakeView("window", 7)]);
    const update = vi.spyOn(browser.windows, "update").mockResolvedValue({} as never);
    const create = vi.spyOn(browser.windows, "create").mockResolvedValue({} as never);

    await openStandaloneWindow();

    expect(update).toHaveBeenCalledWith(7, { focused: true });
    expect(create).not.toHaveBeenCalled();
  });
});
