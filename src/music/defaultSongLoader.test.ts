import { describe, expect, it, vi } from "vitest";
import { applyIfCurrent, createCoalescedLoader } from "./defaultSongLoader";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

describe("default song loader", () => {
  it("coalesces concurrent requests and retries after a load error", async () => {
    const load = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce("default song");
    const getSong = createCoalescedLoader(load);

    const first = getSong();
    expect(getSong()).toBe(first);
    await expect(first).rejects.toThrow("temporary failure");
    expect(await getSong()).toBe("default song");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not apply the background song after a user action supersedes the initial load", async () => {
    const loaded = deferred<string>();
    const getSong = createCoalescedLoader(() => loaded.promise);
    let selectionVersion = 0;
    const apply = vi.fn();
    const request = applyIfCurrent(
      getSong,
      () => selectionVersion === 0,
      apply,
    );

    selectionVersion++;
    loaded.resolve("default song");
    await expect(request).resolves.toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });

  it("applies the initial song if no user action supersedes it", async () => {
    const apply = vi.fn();
    const request = applyIfCurrent(
      () => Promise.resolve("default song"),
      () => true,
      apply,
    );

    await expect(request).resolves.toBe(true);
    expect(apply).toHaveBeenCalledWith("default song");
  });
});
