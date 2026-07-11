# External Services, Integrations & Background Jobs

[← Back to System Architecture](../system-architecture.md)

The current codebase does not define dedicated third-party service wrappers for payments, SMS, push notifications, object storage, or cron jobs.

## Integrations at a Glance

| Service | File | What it does | Key env vars |
| --- | --- | --- | --- |
| MongoDB | `config/db.js` | Opens the database connection used by every module. | `MONGODB_URI` |
| JWT signing / verification | `utils/generateToken.js`, `middlewares/auth.js`, `modules/user/service.js` | Issues access tokens and verifies bearer tokens. | `JWT_SECRET` |
| Password hashing | `modules/user/service.js` | Hashes and compares passwords. | None |

## Integration Deep-Dives

There are no non-trivial external-provider flows such as payment webhooks, email provider callbacks, SMS gateways, or file storage uploads in the codebase.

## Notification Pipeline

The user service constructs OTP and password-reset payloads, but the code does not send them through an email or SMS provider. Instead, the OTP and reset-link payloads are returned in the API response, with inline comments noting that production would send them by email.

## Cron / Scheduled Jobs

| Schedule | Job description | Module/file |
| --- | --- | --- |
| None | No scheduled jobs are registered in the repository. | N/A |

