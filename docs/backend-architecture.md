# Backend Architecture

This document outlines the server-side architecture, responsibilities, and implementation choices.

## Overview

The backend is implemented with Node.js and Express and follows a controller-driven pattern. Responsibilities include:

- Authentication and authorization (JWT + Passport for Google OAuth).
- Message ingestion, storage and delivery.
- Group management and member orchestration.
- Media uploads and integration with Cloudinary.
- Email flows using a nodemailer wrapper and templates in `server/emailTemplates`.

### Key folders

- `server/controllers` — feature controllers that orchestrate business logic.
- `server/models` — Mongoose models for `User`, `Message`, `Group`, and `Otp`.
- `server/routes` — thin routing layer that wires controllers to REST endpoints.
- `server/lib` — third-party integrations (Cloudinary, MongoDB connector, Passport). 
- `server/crypto` — cryptographic helpers used by the messaging pipeline.

## Message ingestion & storage

- Clients send encrypted payloads to message endpoints. The API persists ciphertext with metadata for efficient retrieval.
- There are endpoints for bulk-decrypt operations and public-key distribution to support secure key exchange.

## Security & crypto

- Hybrid approach: ECC for key exchange and AES for symmetric encryption of message content.
- Private keys are handled client-side where possible; the server provides key exchange endpoints and stores only the data required for delivery and auditing.

## Integration points

- Google OAuth and Contacts API for identity and contact import.
- Cloudinary for media storage and CDN accessibility.
- SMTP via nodemailer for verification and transactional emails.

## Operational considerations

- The API is stateless by design for horizontal scaling behind a load balancer.
- Add a Redis cache layer for frequently accessed metadata and presence information.
- Offload heavy I/O and compute to background workers using an async queue system.
