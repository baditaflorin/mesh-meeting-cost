import { useEffect, useRef, useState } from "react";
import {
  createClockSync,
  MeshButton,
  MeshLaunch,
  MeshNameInput,
  MeshPresence,
  MeshStatusPill,
  MeshSurface,
  type ClockSync,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

/** Only the numeric contribution is shared. The contributor name stays local. */
type Participant = { hourlyRate: number };

const NAME_KEY = (prefix: string) => `${prefix}:displayName`;
const RATE_KEY = (prefix: string) => `${prefix}:hourlyRate`;

function sharedNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function participantRate(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  return sharedNumber((value as Participant).hourlyRate);
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    (hours > 0 ? `${String(hours).padStart(2, "0")}:` : "") +
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <main className="meeting-cost meeting-cost-loading">
        <MeshLaunch
          className="meeting-cost-launch"
          eyebrow="Shared meeting ledger"
          heading="Opening the cost meter"
          promise="Preparing the live room where your team can see one synchronized total."
          loading
          connectionHint="Connecting to the shared ledger"
          primaryAction={{ label: "Connecting", disabled: true }}
        />
      </main>
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
  const clockRef = useRef<ClockSync | null>(null);

  useEffect(() => {
    if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
  }, [name, config.storagePrefix]);

  useEffect(() => {
    if (rate) localStorage.setItem(RATE_KEY(config.storagePrefix), rate);
  }, [rate, config.storagePrefix]);

  useEffect(() => {
    const participants = room.doc.getMap<Participant>("participants");
    const session = room.doc.getMap<unknown>("session");
    const onChange = () => rerender((n) => n + 1);
    participants.observe(onChange);
    session.observe(onChange);
    return () => {
      participants.unobserve(onChange);
      session.unobserve(onChange);
    };
  }, [room]);

  useEffect(() => {
    const clock = createClockSync(room.provider);
    clockRef.current = clock;
    return () => {
      if (clockRef.current === clock) clockRef.current = null;
      clock.destroy();
    };
  }, [room]);

  const participants = room.doc.getMap<Participant>("participants");
  const session = room.doc.getMap<unknown>("session");
  const running = session.get("running") === true;
  const startedAt = sharedNumber(session.get("startedAt"));
  const baseElapsedMs = sharedNumber(session.get("elapsedMs"));

  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [running]);

  // Sum of all participants' hourly rates — UI-level "aggregate only" treatment.
  let totalHourly = 0;
  let participantCount = 0;
  participants.forEach((p) => {
    const hourlyRate = participantRate(p);
    if (hourlyRate > 0) {
      totalHourly += hourlyRate;
      participantCount++;
    }
  });

  const currentTime = clockRef.current?.meshNow() ?? Date.now();
  const elapsedMs =
    baseElapsedMs + (running && startedAt > 0 ? Math.max(0, currentTime - startedAt) : 0);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const cost = (totalHourly * elapsedMs) / 3_600_000;

  const myEntry = participants.get(room.peerId);
  const parsedRate = Number(rate);
  const validRate = Number.isFinite(parsedRate) && parsedRate > 0;
  const canSaveContribution = Boolean(name.trim()) && validRate;
  const roomPeople = room.peerCount + 1;
  const hasContributions = participantCount > 0;

  const join = () => {
    if (!canSaveContribution) return;
    participants.set(room.peerId, { hourlyRate: parsedRate });
  };

  const leave = () => participants.delete(room.peerId);

  const start = () => {
    if (!hasContributions) return;
    room.doc.transact(() => {
      session.set("running", true);
      session.set("startedAt", clockRef.current?.meshNow() ?? Date.now());
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

  return (
    <main
      className="meeting-cost"
      aria-labelledby="meeting-cost-heading"
      data-testid="meeting-cost-surface"
    >
      <header className="meeting-cost-header">
        <div className="meeting-cost-heading-group">
          <p className="meeting-cost-eyebrow">Shared meeting ledger</p>
          <h1 id="meeting-cost-heading">Meeting cost</h1>
          <p className="meeting-cost-description">
            One synchronized total for the time your team is spending together.
          </p>
        </div>
        <div className="meeting-cost-context" aria-label="Room context">
          <MeshStatusPill
            className="cost-session-status"
            tone={running ? "live" : hasContributions ? "info" : "neutral"}
            dot={running}
            announce="polite"
          >
            {running ? "Meeting live" : hasContributions ? "Ready to start" : "Add a rate"}
          </MeshStatusPill>
          <MeshPresence
            count={roomPeople}
            label="in this room"
            state={room.peerCount > 0 ? "connected" : "idle"}
            className="cost-presence"
            data-testid="room-presence"
          />
        </div>
      </header>

      <div className="meeting-cost-grid">
        <MeshSurface as="section" tone="raised" padding="lg" className="cost-meter-card">
          <div className="cost-card-header">
            <div>
              <p className="cost-card-kicker">Live total</p>
              <h2>Current meeting cost</h2>
            </div>
            <p className="cost-status">
              {participantCount} {participantCount === 1 ? "rate" : "rates"} in the shared total
            </p>
          </div>

          <div className="cost-meter">
            <output
              className="cost-money"
              aria-live="polite"
              aria-label={`Current meeting cost is ${formatMoney(cost)} dollars`}
            >
              ${formatMoney(cost)}
            </output>
            <dl className="cost-metrics" aria-label="Meeting cost details">
              <div>
                <dt>Elapsed</dt>
                <dd className="cost-time">{formatDuration(elapsedSec)}</dd>
              </div>
              <div>
                <dt>Team burn rate</dt>
                <dd className="cost-rate">
                  {hasContributions ? (
                    <>
                      <strong>${formatMoney(totalHourly)}</strong>/hr
                    </>
                  ) : (
                    <span>No rates yet</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="cost-controls" aria-label="Meeting controls">
            <MeshButton
              className="cost-primary-action"
              data-testid="primary-action"
              size="lg"
              onClick={running ? pause : start}
              disabled={!running && !hasContributions}
            >
              {running ? "Pause meeting" : elapsedMs > 0 ? "Resume meeting" : "Start meeting"}
            </MeshButton>
            <MeshButton
              variant="quiet"
              size="lg"
              className="cost-reset"
              onClick={reset}
              disabled={running || elapsedMs === 0}
            >
              Reset timer
            </MeshButton>
          </div>
          {!hasContributions && (
            <p className="cost-action-hint">Add a rate to unlock the shared timer.</p>
          )}
        </MeshSurface>

        <MeshSurface as="section" tone="base" padding="lg" className="cost-contribution-card">
          <div className="cost-card-header cost-contribution-header">
            <div>
              <p className="cost-card-kicker">Your contribution</p>
              <h2>Add your hourly cost</h2>
            </div>
            {myEntry ? (
              <MeshStatusPill tone="success" dot>
                Included
              </MeshStatusPill>
            ) : null}
          </div>

          <div className="cost-contribution-fields">
            <MeshNameInput
              value={name}
              onChange={setName}
              placeholder="Your name"
              label="Your name"
              hint="Stored only on this device."
              maxLength={32}
              showCounter
            />
            <label className="cost-rate-field">
              <span className="cost-rate-field-label">Your hourly cost</span>
              <span className="cost-rate-input-wrap">
                <span aria-hidden="true">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                  placeholder="0"
                  aria-label="hourly rate"
                />
                <span aria-hidden="true">/hr</span>
              </span>
            </label>
          </div>

          <div className="cost-contribution-actions">
            <MeshButton
              className="cost-contribution-action"
              fullWidth
              onClick={join}
              disabled={!canSaveContribution}
            >
              {myEntry ? "Update contribution" : "Add to team total"}
            </MeshButton>
            {myEntry ? (
              <MeshButton variant="quiet" size="sm" onClick={leave}>
                Remove my rate
              </MeshButton>
            ) : null}
          </div>
          {myEntry ? (
            <p className="cost-me-status">
              You are contributing <strong>${formatMoney(participantRate(myEntry))}/hr</strong> to
              the shared total.
            </p>
          ) : (
            <p className="cost-privacy">
              Your rate is shared only to calculate the room total. This surface never attaches a
              rate to a name.
            </p>
          )}
        </MeshSurface>
      </div>

      <aside className="cost-note" aria-label="How the shared ledger works">
        <span>Peer-to-peer</span>
        <p>Rates and timer state synchronize directly with everyone in this room.</p>
      </aside>
    </main>
  );
}
