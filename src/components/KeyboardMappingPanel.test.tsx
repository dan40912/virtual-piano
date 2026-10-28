// @vitest-environment happy-dom
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { KeyboardMappingPanel } from "./KeyboardMappingPanel";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;

const callbacks = {
  onSelectMappingNote: vi.fn(),
  onBindShortcut: vi.fn(),
  onCancelConflict: vi.fn(),
  onCancelPending: vi.fn(),
  onClearSelected: vi.fn(),
  onRestoreDefaults: vi.fn(),
  onExport: vi.fn(),
  onImport: vi.fn(),
  onPedalChange: vi.fn(),
  onProfileChange: vi.fn(),
  onSaveProfile: vi.fn(),
  onLoadProfile: vi.fn(),
};

beforeEach(async () => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<KeyboardMappingPanel
    mapping={{ KeyA: 60 }}
    profiles={{ Practice: { KeyA: 60 } }}
    pedal="Space"
    selected={60}
    pendingBinding="KeyB"
    bindingConflict={{ code: "KeyA", midi: 62, occupied: 60 }}
    warning="測試狀態"
    profile="Practice"
    {...callbacks}
  />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function click(selector: string) {
  await act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
}

it("keeps mapping selection, conflict replacement, and conflict cancellation actions", async () => {
  expect(container.querySelectorAll(".mapping-grid button")).toHaveLength(88);
  expect(container.querySelector('.mapping-grid button[aria-pressed="true"]')?.getAttribute("aria-label")).toContain("C4");
  expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe("測試狀態");
  await click('.mapping-grid button[aria-label^="D4"]');
  expect(callbacks.onSelectMappingNote).toHaveBeenCalledWith(62);
  await click(".mapping-conflict-actions .primary");
  expect(callbacks.onBindShortcut).toHaveBeenCalledWith("KeyA", 62, true);
  await click(".mapping-conflict-actions button:not(.primary)");
  expect(callbacks.onCancelConflict).toHaveBeenCalledOnce();
});

it("keeps configuration, import/export, pedal, and profile controls", async () => {
  await click(".modal-actions button:nth-child(1)");
  await click(".modal-actions button:nth-child(2)");
  await click(".modal-actions button:nth-child(3)");
  await click(".modal-actions button:nth-child(4)");
  await click(".modal-actions button:nth-child(5)");
  expect(callbacks.onClearSelected).toHaveBeenCalledOnce();
  expect(callbacks.onCancelPending).toHaveBeenCalledOnce();
  expect(callbacks.onRestoreDefaults).toHaveBeenCalledOnce();
  expect(callbacks.onExport).toHaveBeenCalledOnce();
  expect(callbacks.onImport).toHaveBeenCalledOnce();
  expect(container.querySelectorAll('.stage-segmented[aria-label="踏板按鍵"] button')).toHaveLength(2);
  expect(container.querySelectorAll('.stage-segmented[aria-label="載入配置"] button')).toHaveLength(1);
});
