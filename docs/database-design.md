# Database Design

SynapTalk uses MongoDB with Mongoose models for flexible schema evolution and rapid iteration. The document below summarizes the primary collections and rationale.

## Primary models

- `User` — identity, public key material, OAuth tokens (encrypted), profile metadata, and social links.
- `Message` — encrypted payloads, sender/recipient metadata, timestamps, delivery/read state, and attachment references.
- `Group` — group membership, metadata, and group message indexing.
- `Otp` — temporary OTP storage for verification and password resets.

## Indexing & query patterns

- Messages: compound indexes on (conversationId, createdAt) or (groupId, createdAt) to support fast tail queries.
- Users: indexes on `email` and `username` for quick lookup during auth flows.
- Group membership: consider a partial index or membership collection to scale very large groups.

## Scaling considerations

- Sharding: the messages collection is the most write-heavy; sharding on a conversation or tenant key is a natural evolution for very large workloads.
- Read replicas: configure read replicas for analytics and heavy read workloads.
