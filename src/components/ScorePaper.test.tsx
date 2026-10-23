// @vitest-environment happy-dom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ScorePaper } from "./ScorePaper";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, container: HTMLDivElement;
const onXml = vi.fn(async () => {});
beforeEach(async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:score-test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ScorePaper onXml={onXml} />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  onXml.mockClear();
});
async function upload(name: string) {
  const input = container.querySelector("input")!;
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["test"], name)],
  });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
}
it("shows a local image and releases its URL when removed", async () => {
  await upload("hymn.png");
  expect(container.querySelector("img")?.alt).toBe("hymn.png");
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="移除琴譜"]')!
      .click(),
  );
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:score-test");
  expect(container.querySelector("img")).toBeNull();
});
it("embeds PDF and delegates MusicXML to the music importer", async () => {
  await upload("hymn.pdf");
  expect(container.querySelector("object")?.getAttribute("type")).toBe(
    "application/pdf",
  );
  await upload("hymn.musicxml");
  expect(onXml).toHaveBeenCalledOnce();
});
it("rejects unsupported files without creating an object URL", async () => {
  await upload("hymn.mid");
  expect(container.querySelector('[role="status"]')?.textContent).toContain(
    "請選 PDF",
  );
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
