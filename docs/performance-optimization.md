# Performance & Optimization

Key optimizations and performance design choices implemented or recommended.

## Implemented optimizations

- Non-blocking request paths: message ingestion persists ciphertext quickly, enabling the client to receive an optimistic response.
- Bulk-decrypt endpoints to support batched client-side decryption flows reducing round-trips.

## Recommended optimizations

- Add request-level caching for frequently accessed resources using Redis.
- Use pagination and tail queries with appropriate indexes for message retrieval.
- Profile media upload latency and implement resumable uploads where applicable.
