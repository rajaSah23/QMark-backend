# Database - MongoDB, Mongoose & the Domain Model

[← Back to System Architecture](../system-architecture.md)

## Engine & Configuration

- The database engine is MongoDB.
- The query/model layer is Mongoose.
- The connection helper lives in `config/db.js` and calls `mongoose.connect(process.env.MONGODB_URI)`.
- The app does not define connection pool settings in code.
- The schema strategy is model-driven; there are no migration files and no `sync()` calls.

## Models & Migrations

- Models are defined per module rather than in a central `models/` folder.
- Associations are declared in Mongoose schema fields through `ref` values and populated at query time.
- The codebase does not include migration files.
- Relevant scripts are `npm run dev` and `npm start`.

## Core Domain Entities

| Entity | File | Notable fields | Key associations |
| --- | --- | --- | --- |
| `User` | `modules/user/userModel.js` | `name`, `profileImage`, `email`, `password`, `otp`, `otpExpiresAt`, `isVerified`, `role`, `active` | Referenced by MCQ, Quiz, Activity, Token, QuestionOptionClick. |
| `Token` | `modules/user/tokenModel.js` | `userId`, `token`, `validity` | Linked to `User` via `userId` for password reset. |
| `subject` | `modules/master/subjectModel.js` | `user`, `subject`, `active` | Referenced by `Topic`, `MCQ`, and `Quiz`. |
| `topic` | `modules/master/topicModel.js` | `user`, `subject`, `topic`, `active` | Belongs to `subject`; referenced by `MCQ`. |
| `MCQ` | `modules/mcq/model.js` | `user`, `question`, `options`, `correctAnswer`, `difficulty`, `subject`, `topic`, `tag`, `explanation`, `bookmark`, `status`, `comments` | Belongs to `User`, `subject`, and `topic`; contains embedded comments. |
| `QuestionOptionClick` | `modules/mcq/optionClickModel.js` | `user`, `question`, `selectedAnswer`, `isCorrect` | Belongs to `User` and `MCQ`. |
| `Quiz` | `modules/quiz/model.js` | `user`, `title`, `description`, `subject`, `questions`, `settings`, `active`, `deleted` | Belongs to `User` and `subject`; references many `MCQ` ids. |
| `QuizAttempt` | `modules/quiz/attemptModel.js` | `user`, `quiz`, `answers`, `score`, `totalQuestions`, `timeTaken` | Belongs to `User` and `Quiz`; embeds answer records. |
| `Activity` | `modules/performance/model.js` | `user`, `date`, `questionsAdded`, `practiceAttempts`, `practiceSessions`, `revisionsAttempts`, `revisionsSessions`, `totalActivity` | Belongs to `User`; indexed by `user` and `date`. |

## ER Diagram

```mermaid
erDiagram
  User {
    ObjectId _id
    string name
    string email
    string password
    boolean isVerified
    string role
    boolean active
  }

  Token {
    ObjectId _id
    ObjectId userId
    string token
    date validity
  }

  subject {
    ObjectId _id
    ObjectId user
    string subject
    boolean active
  }

  topic {
    ObjectId _id
    ObjectId user
    ObjectId subject
    string topic
    boolean active
  }

  MCQ {
    ObjectId _id
    ObjectId user
    string question
    string[] options
    string correctAnswer
    string difficulty
    ObjectId subject
    ObjectId topic
    boolean bookmark
    boolean status
  }

  QuestionOptionClick {
    ObjectId _id
    ObjectId user
    ObjectId question
    string selectedAnswer
    boolean isCorrect
  }

  Quiz {
    ObjectId _id
    ObjectId user
    string title
    ObjectId subject
    ObjectId[] questions
    boolean active
    boolean deleted
  }

  QuizAttempt {
    ObjectId _id
    ObjectId user
    ObjectId quiz
    number score
    number totalQuestions
    number timeTaken
  }

  Activity {
    ObjectId _id
    ObjectId user
    date date
    number totalActivity
  }

  User ||--o{ Token : resets
  User ||--o{ subject : owns
  User ||--o{ topic : owns
  User ||--o{ MCQ : owns
  User ||--o{ QuestionOptionClick : records
  User ||--o{ Quiz : owns
  User ||--o{ QuizAttempt : submits
  User ||--o{ Activity : tracks
  subject ||--o{ topic : contains
  subject ||--o{ MCQ : classifies
  subject ||--o{ Quiz : groups
  topic ||--o{ MCQ : classifies
  MCQ ||--o{ QuestionOptionClick : clicked_by
  Quiz ||--o{ QuizAttempt : has
  Quiz }o--o{ MCQ : includes
```

## Redis / Cache Usage

- No Redis client or cache key pattern appears in the codebase.

