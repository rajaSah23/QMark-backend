# QMark Backend Documentation

The QMark backend is a Node.js and Express API for quiz creation, question management, subject/topic maintenance, and performance analytics.

New here? Start with [system-architecture.md](system-architecture.md), then follow the architecture deep-dives and feature docs.

[← Back to System Architecture](system-architecture.md)

## Docs Index

| Doc | Read it to learn... |
| --- | --- |
| [system-architecture.md](system-architecture.md) | The big-picture system shape, stack, portals, and how requests move through the app. |
| [architecture/01-request-flow.md](architecture/01-request-flow.md) | Bootstrap order, middleware pipeline, request lifecycle, and error handling. |
| [architecture/02-folder-structure.md](architecture/02-folder-structure.md) | Repository layout, folder responsibilities, and how each module is layered. |
| [architecture/03-auth.md](architecture/03-auth.md) | Authentication flows, role checks, token behavior, and protected-request logic. |
| [architecture/04-database.md](architecture/04-database.md) | MongoDB, Mongoose, the domain models, and how the data layer is related. |
| [architecture/05-external-services.md](architecture/05-external-services.md) | External integrations and background jobs, or the lack of them in this codebase. |
| [features/README.md](features/README.md) | A feature-by-feature map of the modules in this backend. |
| [features/01-user-account.md](features/01-user-account.md) | The user lifecycle: register, verify OTP, login, profile, and password changes. |
| [features/02-master-content.md](features/02-master-content.md) | Subject and topic management for the question taxonomy. |
| [features/03-mcq-library.md](features/03-mcq-library.md) | MCQ authoring, retrieval, bookmarking, comments, and click analytics. |
| [features/04-quiz-engine.md](features/04-quiz-engine.md) | Quiz creation, quiz delivery, and attempt grading. |
| [features/05-performance-analytics.md](features/05-performance-analytics.md) | Daily activity, streaks, quiz stats, subject-wise analytics, and summary metrics. |

## Conventions Used In These Docs

- Mermaid diagrams are used for flows and relationships.
- File links are relative to the project root.
- These docs describe the code as it exists now, not as it might evolve later.
- If a behavior is missing from the code, the docs say so instead of filling in the gap.
