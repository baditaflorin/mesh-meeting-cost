# Privacy — mesh-meeting-cost

## Threat model

This app is a peer-to-peer mesh. Any data that is shared via Yjs (the CRDT) or awareness is **visible to every other peer in the same room**. Treat the contents of a mesh room as semi-public among the people you share the room ID with.

### What other peers can see

- The numeric hourly contribution each device adds to the room, the running/paused state, and elapsed meeting time. Those values are required to calculate the same total on every peer.
- The contribution record's transient WebRTC peer ID. The app does not put your display name in the shared meeting-cost record.
- All Yjs CRDT state: every item, vote, edit, claim, message — whatever the app stores in shared Y.Map / Y.Array structures. The in-app surface deliberately shows aggregate numbers, but a peer with developer tools can inspect shared CRDT values.
- Per-peer awareness state: ephemeral presence info (cursor, mood, ms-precision clock pings) for the duration of the connection.
- Your peer ID, a transient WebRTC client ID. Not tied to a user account.

### What the self-hosted infra can see

- The signaling server (`wss://turn.0docker.com/ws`) sees connection metadata: IP address, room ID hash, time of connection. It does **not** see message contents — all peer messages go directly over the WebRTC data channel.
- The TURN relay (`turn:turn.0docker.com:3479`) is only used when direct peer connection fails (strict NATs). When relayed, traffic flows through the TURN box but remains end-to-end encrypted (DTLS-SRTP).

### What stays local

- Your display name and the hourly-cost draft before you choose **Add to team total**.
- Settings: signaling/TURN overrides, room ID — all in localStorage.
- Nothing is persisted server-side. When all peers leave the room, the CRDT state evaporates.

## No accounts, no analytics

No login. No tracking pixels. No third-party analytics. No service worker error beacons.

## If you want stronger anonymity

This app does not use Semaphore-style commit-reveal for anonymity within the mesh. If anonymity matters for your use case, see the `mesh-mafia` reference app for the commit-reveal pattern.
