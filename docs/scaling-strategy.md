# Scaling Strategy

This document outlines how SynapTalk can scale from prototype to a production-grade deployment.

## Horizontal scaling

- API: stateless Node.js processes behind a load balancer.
- Database: move to sharded MongoDB clusters if message volume demands it.
- Media: Cloudinary scales independently via CDN.

## Background processing

- Introduce a durable queue (Redis + BullMQ) for heavy work: media processing, notifications, and bulk-decrypt jobs.

## Signaling & RTC

- For large concurrent calling loads, separate signaling into a dedicated horizontally scalable service and rely on TURN servers for fallback.

## Caching

- Use Redis for presence, session caching, and short-lived metadata.

## Operational scaling

- Autoscale based on request latency and queue backlog metrics.
