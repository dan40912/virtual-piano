export interface MidiInputPortLike {
  id: string;
  name?: string | null;
  state?: string;
  type: string;
  onmidimessage: ((event: { data?: Uint8Array | null }) => void) | null;
}

export interface MidiAccessLike {
  inputs: { values: () => IterableIterator<MidiInputPortLike> };
  onstatechange: ((event: { port?: MidiInputPortLike }) => void) | null;
}

export interface MidiCallbacks {
  onDown: (id: string, midi: number, velocity: number) => void;
  onUp: (id: string) => void;
  onPedal: (source: string, down: boolean) => void;
  onStateChange?: (inputCount: number) => void;
}

export async function requestMidiAccess(
  request: () => Promise<MidiAccessLike>,
  callbacks: MidiCallbacks,
  isCurrent: () => boolean = () => true,
) {
  const access = await request();
  if (!isCurrent()) return null;
  return attachMidiAccess(access, callbacks);
}

/** Attaches only MIDI inputs and guarantees a note-off/pedal-up during teardown. */
export function attachMidiAccess(access: MidiAccessLike, callbacks: MidiCallbacks) {
  const inputs = new Map<string, MidiInputPortLike>();
  const activeNotes = new Map<string, Set<string>>();
  const activePedals = new Set<string>();

  const releaseChannel = (portId: string, channel: number) => {
    const channelKey = `${portId}:${channel}`;
    for (const id of activeNotes.get(channelKey) || []) callbacks.onUp(id);
    activeNotes.delete(channelKey);
    if (activePedals.delete(channelKey)) callbacks.onPedal(`midi:${channelKey}`, false);
  };
  const releasePort = (portId: string) => {
    for (const key of [...activeNotes.keys(), ...activePedals]) {
      if (!key.startsWith(`${portId}:`)) continue;
      const channel = Number(key.slice(portId.length + 1));
      releaseChannel(portId, channel);
    }
  };
  const attach = (port: MidiInputPortLike) => {
    if (port.type !== "input" || port.state === "disconnected") return;
    inputs.set(port.id, port);
    callbacks.onStateChange?.(inputs.size);
    port.onmidimessage = ({ data }) => {
      if (!data || data.length < 2) return;
      const [statusByte, data1, value = 0] = data;
      const command = statusByte & 0xf0;
      const channel = statusByte & 0x0f;
      const channelKey = `${port.id}:${channel}`;
      const pedalSource = `midi:${channelKey}`;
      const noteId = `midi:${channelKey}:${data1}`;
      if (command === 0x90 && value > 0) {
        let notes = activeNotes.get(channelKey);
        if (!notes) activeNotes.set(channelKey, (notes = new Set()));
        notes.add(noteId);
        callbacks.onDown(noteId, data1, value / 127);
      } else if (command === 0x80 || (command === 0x90 && value === 0)) {
        callbacks.onUp(noteId);
        activeNotes.get(channelKey)?.delete(noteId);
      } else if (command === 0xb0 && data1 === 64) {
        const down = value >= 64;
        if (down) activePedals.add(channelKey);
        else activePedals.delete(channelKey);
        callbacks.onPedal(pedalSource, down);
      } else if (command === 0xb0 && (data1 === 120 || data1 === 123)) {
        releaseChannel(port.id, channel);
      }
    };
  };

  for (const port of access.inputs.values()) attach(port);
  access.onstatechange = ({ port }) => {
    if (!port || port.type !== "input") return;
    if (port.state === "connected") attach(port);
    else {
      releasePort(port.id);
      port.onmidimessage = null;
      inputs.delete(port.id);
      callbacks.onStateChange?.(inputs.size);
    }
  };

  return {
    inputCount: () => inputs.size,
    disconnect: () => {
      for (const portId of inputs.keys()) releasePort(portId);
      for (const port of inputs.values()) port.onmidimessage = null;
      access.onstatechange = null;
      inputs.clear();
      callbacks.onStateChange?.(0);
    },
  };
}
