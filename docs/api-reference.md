# API Reference

This file summarizes the implemented REST API surface. For exact route code, see `server/routes`.

## Users (`/api/users/*`)
- `POST /signup` — create a new user account.
- `POST /login` — user authentication, returns JWT.
- `PUT /update-profile` — authenticated profile updates.
- `GET /check` — token health check and authenticated user info.
- OAuth: `GET /google` and `GET /google/callback` for Google OAuth flows.
- `GET /google/contacts` — fetch a user's Google contacts (requires Google login & stored tokens).

## Messages (`/api/messages/*`)
- `GET /users` — users list used by sidebar.
- `POST /decrypt` — decrypt a single message (protected endpoint).
- `POST /bulk-decrypt` — bulk decrypt support for batched operations.
- `POST /:id` — fetch messages for a conversation.
- `PUT /mark/:id` — mark a message as seen.
- `POST /send/:id` — send an encrypted message to a recipient.
- `GET /latest-msg` — fetch the latest messages for the client view.
- `GET /public-key/:userId` — fetch a user's public key for encryption.

## Groups (`/api/groups/*`)
- `POST /new-group` — create a new group.
- `GET /get-groups` — list groups for the user.
- `GET /latest-grpmsg` — latest group messages.
- `POST /send-grpmsg` — post a message to a group.
- `GET /get-grpmsg/:groupId` — fetch messages for a group.
- `PUT /updateGrp/:id` — update group metadata.
- `PUT /add-extra-mem` — add members to a group.
- `DELETE /delete-mem/:id` — remove a member.

## OTP (`/api/otp/*`)
- `POST /send-verification-otp` — send email verification code.
- `POST /verify-email-otp` — verify email OTP.
- `POST /send-reset-otp` — send password reset code.
- `POST /verify-reset-otp` — verify reset OTP.

## AI (`/api/ai/*`)
- `POST /message` — send an AI-assistant request (protected endpoint).

---

Authentication: most endpoints require a valid `Authorization: Bearer <token>` header. See `server/middleware/auth.js` for enforcement details.
