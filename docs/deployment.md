# Deployment

This document outlines a production-inspired topology and practical deployment steps.

## Recommended topology

- Frontend: static hosting (Vercel, Netlify, or S3+CloudFront) serving the React app.
- API: containerized Node.js service (Docker) behind a load balancer (NGINX / managed LB).
- Database: managed MongoDB (Atlas) with backups and monitoring.
- Media: Cloudinary for uploads and CDN distribution.
- Background workers: containerized workers using a queue (Redis + BullMQ) for offline tasks.

## Containerization (example)

1. Build and publish Docker images for `server`.
2. Deploy to a container orchestrator (Kubernetes or ECS) with autoscaling rules.
3. Use a managed Redis for queues and a managed MongoDB for persistence.

## Environment & secrets

- Use a secure secret store (AWS Secrets Manager, Vault) for `JWT_SECRET`, `CLOUDINARY_*`, SMTP credentials, and OAuth secrets.

## Zero-downtime deployment tips

- Use rolling updates for API deployments and readiness probes to avoid routing to unhealthy pods.
- Run DB migrations (if any) in a backward-compatible way; avoid table/collection rewrites in a single step.
