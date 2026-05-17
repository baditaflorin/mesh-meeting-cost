import { useEffect, useState } from "react";
import { MeshNameInput, type MeshConfig, type YRoom } from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Participant = { name: string; hourlyRate: number };

const NAME_KEY = (prefix: string) => `${prefix}:displayName`;
const RATE_KEY = (prefix: string) => `${prefix}:hourlyRate`;

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="cost-screen">
        <h1>meeting cost</h1>
        <p className="cost-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const [name, setName] = useState(
    () => localStorage.getItem(NAME_KEY(config.storagePrefix)) ?? "",
  );
  const [rate, setRate] = useState(
    () => localStorage.getItem(RATE_KEY(config.storagePrefix)) ?? "",
  );
  const [, rerender] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
  }, [name, config.storagePrefix]);

  useEffect(() => {
    if (rate) localStorage.setItem(RATE_KEY(config.storagePrefix), rate);
  }, [rate, config.storagePrefix]);

  useEffect(() => {
    const participants = room.doc.getMap<Participant>("participants");
    const session = room.doc.getMap<number | boolean>("session");
    const onChange = () => rerender((n) => n + 1);
    participants.observe(onChange);
    session.observe(onChange);
    return () => {
      participants.unobserve(onChange);
      session.unobserve(onChange);
    };
  }, [room]);

  const participants = room.doc.getMap<Participant>("participants");
  const session = room.doc.getMap<number | boolean>("session");
  const running = Boolean(session.get("running"));
  const startedAt = Number(session.get("startedAt") ?? 0);
  const baseElapsedMs = Number(session.get("elapsedMs") ?? 0);

  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [running]);

  // Sum of all participants' hourly rates — UI-level "aggregate only" treatment.
  let totalHourly = 0;
  let participantCount = 0;
  participants.forEach((p) => {
    if (p.hourlyRate > 0) {
      totalHourly += p.hourlyRate;
      participantCount++;
    }
  });

  const elapsedMs = baseElapsedMs + (running ? Math.max(0, Date.now() - startedAt) : 0);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const cost = (totalHourly * elapsedMs) / 3_600_000;

  const myEntry = participants.get(room.peerId);

  const join = () => {
    const r = Number(rate);
    if (!name.trim() || !Number.isFinite(r) || r <= 0) return;
    participants.set(room.peerId, { name: name.trim(), hourlyRate: r });
  };

  const leave = () => participants.delete(room.peerId);

  const start = () => {
    room.doc.transact(() => {
      session.set("running", true);
      session.set("startedAt", Date.now());
    });
  };

  const pause = () => {
    room.doc.transact(() => {
      session.set("running", false);
      session.set("elapsedMs", elapsedMs);
      session.set("startedAt", 0);
    });
  };

  const reset = () => {
    room.doc.transact(() => {
      session.set("running", false);
      session.set("startedAt", 0);
      session.set("elapsedMs", 0);
    });
  };

  // mark `tick` used so the eslint rule doesn't flag it; the state update is what re-renders us.
  void tick;

  const hh = Math.floor(elapsedSec / 3600);
  const mm = Math.floor((elapsedSec % 3600) / 60);
  const ss = elapsedSec % 60;
  const fmtTime =
    (hh > 0 ? String(hh).padStart(2, "0") + ":" : "") +
    String(mm).padStart(2, "0") +
    ":" +
    String(ss).padStart(2, "0");

  const fmtMoney = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="cost-screen">
      <header className="cost-header">
        <h1>meeting cost</h1>
        <p className="cost-status">
          {participantCount} {participantCount === 1 ? "rate" : "rates"} contributed ·{" "}
          {room.peerCount + 1} present
        </p>
      </header>

      <div className="cost-meter">
        <div className="cost-money">${fmtMoney(cost)}</div>
        <div className="cost-time">{fmtTime}</div>
        <div className="cost-rate">
          {totalHourly > 0 ? (
            <>
              burning <strong>${fmtMoney(totalHourly)}</strong>/hr
            </>
          ) : (
            <em>no rates entered yet</em>
          )}
        </div>
      </div>

      <div className="cost-controls">
        {running ? (
          <button type="button" className="cost-btn cost-pause" onClick={pause}>
            ⏸ pause
          </button>
        ) : (
          <button
            type="button"
            className="cost-btn cost-start"
            onClick={start}
            disabled={totalHourly === 0}
          >
            ▶ start
          </button>
        )}
        <button
          type="button"
          className="cost-btn cost-reset"
          onClick={reset}
          disabled={running || (elapsedMs === 0 && !running)}
        >
          reset
        </button>
      </div>

      <section className="cost-me">
        <h2 className="cost-section-title">your rate</h2>
        <p className="cost-privacy">
          stored in this room but never shown to others by name — only the room total is displayed
        </p>
        <div className="cost-me-fields">
          <MeshNameInput value={name} onChange={setName} placeholder="your name" maxLength={48} />
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="$/hour"
            aria-label="hourly rate"
          />
          {myEntry ? (
            <button type="button" className="cost-btn cost-leave" onClick={leave}>
              remove me
            </button>
          ) : (
            <button
              type="button"
              className="cost-btn cost-join"
              onClick={join}
              disabled={!name.trim() || !Number(rate)}
            >
              add to total
            </button>
          )}
        </div>
        {myEntry && (
          <p className="cost-me-status">
            you're contributing <strong>${fmtMoney(myEntry.hourlyRate)}</strong>/hr to the total
          </p>
        )}
      </section>
    </div>
  );
}
