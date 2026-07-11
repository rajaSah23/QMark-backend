# QMark Backend - Feature Overview

[← Back to Documentation Index](../README.md)
[← Back to System Architecture](../system-architecture.md)

## Feature List Table

| # | Feature | What it is for | Primary route surface |
| --- | --- | --- | --- |
| 1 | User Account | Registration, OTP verification, login, profile, and password changes. | `/api/v1/user` |
| 2 | Master Content | Subjects and topics that organize the question library. | `/api/v1/master` |
| 3 | MCQ Library | Question CRUD, bookmarks, comments, and option-click analytics. | `/api/v1/mcq` |
| 4 | Quiz Engine | Quiz creation, fetching, updating, deletion, and attempt grading. | `/api/v1/quiz` |
| 5 | Performance Analytics | Activity, streak, quiz, subject, difficulty, and summary metrics. | `/api/v1/performance` |

## Feature Summaries

### User Account

The user module handles registration, OTP verification, login, forgotten-password flows, profile reads, and password changes. It is the only feature with both public and protected routes, and it uses `userAuth` for protected profile and password endpoints.

Implemented by `modules/user`.

[Read the full feature doc](01-user-account.md)

### Master Content

The master module manages user-owned subjects and topics. It is the taxonomy layer that other features use to classify MCQs and quizzes.

Implemented by `modules/master`.

[Read the full feature doc](02-master-content.md)

### MCQ Library

The MCQ module owns question CRUD, bookmarks, comments, option-click tracking, and analytics over question interactions. It uses Joi validation inside the service layer and records question activity in the performance module.

Implemented by `modules/mcq`.

[Read the full feature doc](03-mcq-library.md)

### Quiz Engine

The quiz module creates quizzes from selected question ids or filters, returns quizzes with or without correct answers, and grades attempts. It also logs quiz-attempt activity into the performance module.

Implemented by `modules/quiz`.

[Read the full feature doc](04-quiz-engine.md)

### Performance Analytics

The performance module aggregates daily activity, streaks, quiz results, subject performance, difficulty performance, and overall summaries. It reads from activity, MCQ, and quiz-attempt collections.

Implemented by `modules/performance`.

[Read the full feature doc](05-performance-analytics.md)
