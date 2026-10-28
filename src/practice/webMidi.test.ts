import { describe, expect, it } from "vitest";
import { attachMidiAccess, requestMidiAccess, type MidiAccessLike, type MidiCallbacks, type MidiInputPortLike } from "./webMidi";

function fakePort(id: string, type = "input"): MidiInputPortLike & { send: (...bytes: number[]) => void } {
  const port: MidiInputPortLike & { send: (...bytes: number[]) => void } = {
    id,
    type,
    state: "connected",
    onmidimessage: null,
    send(...bytes) { port.onmidimessage?.({ data: Uint8Array.from(bytes) }); },
  };
  return port;
}

function fakeAccess(ports: MidiInputPortLike[]) {
  return {
    access: {
      inputs: { values: () => ports.values() },
      onstatechange: null,
    } as MidiAccessLike,
    ports,
  };
}

function callbacks(): MidiCallbacks & { downs: unknown[][]; ups: string[]; pedals: unknown[][] } {
  return {
    downs: [], ups: [], pedals: [],
    onDown(id, midi, velocity) { this.downs.push([id, midi, velocity]); },
    onUp(id) { this.ups.push(id); },
    onPedal(source, down) { this.pedals.push([source, down]); },
  };
}

describe("Web MIDI input lifecycle", () => {
  it("maps note-on velocity, note-off and velocity-zero note-on", () => {
    const port = fakePort("keyboard");
    const access = fakeAccess([port]);
    const events = callbacks();
    const controller = attachMidiAccess(access.access, events);
    port.send(0x91, 60, 96);
    port.send(0x81, 60, 40);
    port.send(0x92, 64, 100);
    port.send(0x92, 64, 0);
    expect(events.downs).toEqual([["midi:keyboard:1:60", 60, 96 / 127], ["midi:keyboard:2:64", 64, 100 / 127]]);
    expect(events.ups).toEqual(["midi:keyboard:1:60", "midi:keyboard:2:64"]);
    controller.disconnect();
  });

  it("releases a pedal-only port during teardown", () => {
    const port = fakePort("pedal-only");
    const access = fakeAccess([port]);
    const events = callbacks();
    const controller = attachMidiAccess(access.access, events);
    port.send(0xb2, 64, 127);
    controller.disconnect();
    expect(events.pedals).toEqual([["midi:pedal-only:2", true], ["midi:pedal-only:2", false]]);
    expect(port.onmidimessage).toBeNull();
    expect(access.access.onstatechange).toBeNull();
  });

  it("ignores outputs and releases held notes/pedal when an input disconnects", () => {
    const input = fakePort("keys");
    const output = fakePort("speaker", "output");
    const access = fakeAccess([input, output]);
    const events = callbacks();
    const controller = attachMidiAccess(access.access, events);
    expect(controller.inputCount()).toBe(1);
    expect(output.onmidimessage).toBeNull();
    input.send(0x90, 48, 80);
    input.send(0xb0, 64, 127);
    input.state = "disconnected";
    access.access.onstatechange?.({ port: input });
    expect(events.ups).toEqual(["midi:keys:0:48"]);
    expect(events.pedals.at(-1)).toEqual(["midi:keys:0", false]);
    expect(controller.inputCount()).toBe(0);
    controller.disconnect();
  });

  it("isolates pedal channels and honors all-notes-off", () => {
    const port = fakePort("keyboard");
    const access = fakeAccess([port]);
    const events = callbacks();
    const controller = attachMidiAccess(access.access, events);
    port.send(0xb0, 64, 127);
    port.send(0xb1, 64, 127);
    port.send(0xb0, 64, 0);
    expect(events.pedals).toContainEqual(["midi:keyboard:1", true]);
    expect(events.pedals).toContainEqual(["midi:keyboard:0", false]);
    port.send(0x91, 67, 60);
    port.send(0xb1, 123, 0);
    expect(events.ups).toEqual(["midi:keyboard:1:67"]);
    expect(events.pedals.at(-1)).toEqual(["midi:keyboard:1", false]);
    controller.disconnect();
  });

  it("propagates permission rejection and skips listeners when cancelled while awaiting permission", async () => {
    const events = callbacks();
    await expect(requestMidiAccess(() => Promise.reject(new Error("denied")), events)).rejects.toThrow("denied");
    const port = fakePort("late");
    const access = fakeAccess([port]);
    let resolve!: (value: MidiAccessLike) => void;
    const pending = new Promise<MidiAccessLike>((done) => { resolve = done; });
    let current = true;
    const result = requestMidiAccess(() => pending, events, () => current);
    current = false;
    resolve(access.access);
    await expect(result).resolves.toBeNull();
    expect(port.onmidimessage).toBeNull();
    expect(access.access.onstatechange).toBeNull();
  });
});
