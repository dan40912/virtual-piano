import { useEffect, useRef, useState } from "react";
import { attachMidiAccess, requestMidiAccess, type MidiAccessLike, type MidiCallbacks } from "../practice/webMidi";

export function WebMidiInput({ onDown, onUp, onPedal }: MidiCallbacks) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState("尚未連線");
  const [busy, setBusy] = useState(false);
  const controller = useRef<ReturnType<typeof attachMidiAccess> | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const callbacks = useRef({ onDown, onUp, onPedal });
  callbacks.current = { onDown, onUp, onPedal };

  useEffect(() => {
    mounted.current = true;
    const available = typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
    setSupported(available);
    if (!available) setStatus("此瀏覽器不支援 Web MIDI；請改用電腦鍵盤或觸控琴鍵。");
    return () => {
      mounted.current = false;
      generation.current++;
      controller.current?.disconnect();
      controller.current = null;
    };
  }, []);

  const disconnect = () => {
    generation.current++;
    controller.current?.disconnect();
    controller.current = null;
    setStatus("MIDI 已中斷；所有按住的音符與踏板已釋放。");
  };

  const connect = async () => {
    if (!supported || busy) return;
    setBusy(true);
    const request = ++generation.current;
    try {
      const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<MIDIAccess> };
      const forward = (): MidiCallbacks => ({
        onDown: (...args) => callbacks.current.onDown(...args),
        onUp: (...args) => callbacks.current.onUp(...args),
        onPedal: (...args) => callbacks.current.onPedal(...args),
        onStateChange: (count) => {
          if (mounted.current) setStatus(count ? `${count} 個 MIDI 輸入已連線` : "已啟用 Web MIDI，等待連接鍵盤…");
        },
      });
      controller.current = await requestMidiAccess(
        () => nav.requestMIDIAccess!() as unknown as Promise<MidiAccessLike>,
        forward(),
        () => mounted.current && generation.current === request,
      );
      if (!mounted.current || generation.current !== request) return;
      if (!controller.current) return;
      const count = controller.current.inputCount();
      setStatus(count ? `${count} 個 MIDI 輸入已連線` : "已啟用 Web MIDI，等待連接鍵盤…");
    } catch (error) {
      if (!mounted.current || generation.current !== request) return;
      const message = error instanceof Error ? error.message : "無法連線 MIDI 裝置";
      const secureHint = !window.isSecureContext
        ? "Web MIDI 需要 HTTPS 或 localhost。"
        : /permission|denied|notallowed/i.test(message)
          ? "請允許瀏覽器存取 MIDI 裝置。"
          : "";
      setStatus(`連線失敗：${message}${secureHint ? ` ${secureHint}` : ""}`);
    } finally {
      if (mounted.current && generation.current === request) setBusy(false);
    }
  };

  return (
    <section className="web-midi-input" aria-label="外接 MIDI 鍵盤">
      <div><strong>外接 MIDI 鍵盤</strong><small>音符力度與延音踏板</small></div>
      {controller.current ? (
        <button type="button" onClick={() => {
          if (controller.current?.inputCount()) disconnect();
          else { disconnect(); void connect(); }
        }}>{controller.current.inputCount() ? "中斷連線" : "重新掃描"}</button>
      ) : (
        <button type="button" disabled={!supported || busy} onClick={() => void connect()}>
          {busy ? "連線中…" : "連接 MIDI 鍵盤"}
        </button>
      )}
      <span role="status" aria-live="polite">{status}</span>
    </section>
  );
}
