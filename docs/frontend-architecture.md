# Frontend Architecture

This file describes the client-side design and engineering decisions.

## Technology & structure

- React + Vite for fast development feedback and optimized production bundles.
- Tailwind CSS for rapid styling and consistent utility-based design.
- Contexts for cross-cutting state: `AuthContext`, `ChatContext`, and `CallContext` centralize authentication, message state, and active call state respectively.
- Services: `SignalingService.js` and `WebRTCService.js` encapsulate signaling flows and peer connection lifecycle.

## Component boundaries

- UI is composed of focused components—`MainChat`, `ChatSidebar`, `ProfileSidebar`, and `GroupProfileSidebar`—each responsible for a single interaction surface.
- Notification sub-system is modularized under `client/src/components/Notification/` to centralize event dispatch and toast handling.

## Realtime & sync

- The client maintains a dual communication model: REST for resource operations and a realtime channel (WebSocket/Socket.IO) for events and presence.
- Signaling data for WebRTC is kept light and proxied through the server when necessary.

## Security model

- Clients perform cryptographic operations for end-to-end message confidentiality; secret material is minimized and not stored in server-side plaintext.

## Performance & UX

- Local caching of chat lists and recent messages reduces round-trips and improves perceived latency.
- Optimistic UI updates are used for message send flows, reverting only on server-side failure.
