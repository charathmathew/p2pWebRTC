> Browser-based peer-to-peer video calling with no accounts, no media servers, and no third-party infrastructure touching call content.

This p2p webrtc app connects two people directly via WebRTC. Share a QR code or link — the other person opens it, and the call starts. All audio and video flows encrypted between browsers. Nothing passes through a server you don't control.

Built as a learning project to understand WebRTC, NAT traversal, and real-time systems from first principles.

---

## How it works

```
Peer A                Signaling Server (Bun)              Peer B
  │                          │                              │
  │──── join room ──────────►│◄──── join room ─────────────│
  │◄─── ready ──────────────►│                              │
  │──── SDP offer ──────────►│──── SDP offer ─────────────►│
  │◄─── SDP answer ──────────│◄─── SDP answer ──────────── │
  │──── ICE candidates ─────►│──── ICE candidates ─────────►│
  │                          │                              │
  └──────────── direct P2P media (SRTP encrypted) ─────────┘
                    signaling server no longer involved
```

The signaling server helps peers find each other. Once ICE negotiation completes and hole punching succeeds, all media flows directly between browsers — the server sees nothing.

---

## Features

- **QR code sharing** — generate a call link, share the QR via any channel, recipient opens it and the call starts
- **Zero accounts** — no sign-up, no login, no persistent identity
- **Self-hosted STUN** — custom RFC 5389 implementation replaces Google's STUN server entirely
- **NAT detection** — detects symmetric NAT on page load and warns users before a call attempt
- **P2P text chat** — RTCDataChannel alongside the video stream, encrypted end-to-end, server never sees messages
- **Call controls** — mute, camera toggle, hang up
- **Connection stats** — live display of candidate type (LAN / Internet / Relay) and round-trip time

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) — TypeScript natively, no build step |
| Signaling server | `Bun.serve` native WebSocket API — zero npm dependencies |
| STUN server | Custom TypeScript UDP implementation (RFC 5389) |
| Browser client | Vanilla JS + native WebRTC APIs — single HTML file |
| QR generation | [qrcodejs](https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js) via CDN |
| Transport (media) | WebRTC SRTP — browser-native, mandatory encryption |
| Transport (chat) | RTCDataChannel over DTLS — same encrypted session as media |
| TLS termination | Nginx + Let's Encrypt |

---

## Project structure

```
p2pWebRTC/
├── server/
│   └── server.ts        # Bun signaling server + static file serving
├── stun/
│   └── server.ts        # Custom STUN server (UDP, RFC 5389)
├── client/
│   └── index.html       # Browser client — vanilla JS, single file
├── docs/
│   └── privacy.md       # Privacy properties and trust boundaries
└── README.md
```

---

## Running locally

**Prerequisites:** [Bun](https://bun.sh) installed (`curl -fsSL https://bun.sh/install | bash`)

```bash
# Clone the repo
git clone https://github.com/charathmathew/p2pWebRTC
cd p2pWebRTC

# Start the signaling server (also serves the client on http://localhost:8080)
bun server/server.ts

# In a second terminal, start the STUN server
bun stun/server.ts

# Open http://localhost:8080 in two browser tabs
# The first tab generates a room — copy the URL into the second tab
```

No `npm install`. No build step. Two commands.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Signaling server port |
| `STUN_PORT` | `3478` | STUN server UDP port |
| `STUN_HOST_2` | — | Second STUN server IP for NAT detection |
| `LOG_LEVEL` | `info` | Set to `debug` for verbose signaling logs |

---

## Deployment

### Server requirements

- 1 VPS with a public IP (1 vCPU, 512MB RAM is sufficient)
- TCP 443 open (WSS signaling via Nginx)
- UDP 3478 open (STUN)
- A second public IP or VPS for full NAT type detection (optional)

### Process layout

```
VPS (primary)
  ├── Nginx :443 (TLS) ──► Bun signaling server :8080
  └── Bun STUN server :3478/UDP

VPS (secondary, optional)
  └── Bun STUN server :3478/UDP  ← used for NAT type detection only
```

### Systemd services

```bash
# /etc/systemd/system/p2pWebRTC-server.service
[Unit]
Description=p2pWebRTC signaling server
After=network.target

[Service]
User=p2pWebRTC
WorkingDirectory=/opt/p2pWebRTC
ExecStart=/home/p2pWebRTC/.bun/bin/bun server/server.ts
Restart=always
RestartSec=5
Environment=LOG_LEVEL=info

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable p2pWebRTC-server p2pWebRTC-stun
systemctl start p2pWebRTC-server p2pWebRTC-stun
```

---

## Privacy properties

| Component | Can see | Cannot see |
|---|---|---|
| Signaling server | Room IDs, peer IPs, SDP metadata, call timing | Media content, chat messages |
| STUN server | Peer public IP:port at setup (single UDP exchange) | Media content, ongoing metadata |
| Network (post-ICE) | Encrypted SRTP/DTLS packets | Call or chat content |

**No TURN relay in v1 by design.** Calls rely entirely on direct P2P via UDP hole punching. Users on symmetric NAT (~10–15% of connections) will see a compatibility warning. This is an intentional trade-off — a TURN relay would guarantee connectivity but route media through a server, undermining the privacy model.

See [`docs/privacy.md`](docs/privacy.md) for a full breakdown.

---

## Learning goals

This project is built to understand the following from first principles — not through abstraction layers, but by implementing them directly:

- **NAT and IP networking** — how consumer routers translate addresses, why devices aren't directly reachable, what hole punching actually does
- **STUN protocol (RFC 5389)** — raw UDP sockets, XOR-MAPPED-ADDRESS encoding, why XOR exists
- **ICE and hole punching** — candidate types (host, srflx, relay), connectivity checks, the timing mechanics of simultaneous sends
- **WebRTC internals** — SDP offer/answer model, DTLS key exchange, SRTP media encryption, RTCPeerConnection state machine
- **RTCDataChannel** — how data channels are negotiated in SDP, ordered delivery, shared DTLS session with media
- **WebSocket signaling** — stateful room lifecycle, protocol design, Bun's native WebSocket API
- **Privacy by architecture** — trust boundaries, unavoidable metadata vs. eliminatable exposure

---

## Roadmap

- [x] Custom STUN server (RFC 5389)
- [x] Bun WebSocket signaling server
- [x] WebRTC 1-on-1 video call
- [x] QR code generation and sharing
- [x] NAT type detection
- [x] P2P text chat (RTCDataChannel)
- [x] Call controls and connection stats
- [x] Production deployment (Nginx + TLS + systemd)
- [ ] TURN relay fallback (v2) — self-hosted `coturn`, understand the privacy trade-off
- [ ] Screen sharing (v2)
- [ ] Mobile browser testing and compatibility notes

---

## Why no TURN in v1?

TURN relay servers solve the symmetric NAT problem by routing media through a server both peers can reach. But they fundamentally break the P2P model — the server operator can observe call metadata, and in some configurations, call content.

The goal of v1 is to understand *why* TURN is needed by first experiencing calls fail without it. Adding `coturn` in v2 after seeing symmetric NAT failures in the wild is a more instructive path than including it as boilerplate from the start.

---

## License

MIT
