# Request Flow, Middleware & Error Handling

[← Back to System Architecture](../system-architecture.md)

## Boot Sequence

```text
npm start
└─ node index.js
   ├─ require("dotenv").config()
   ├─ load app from ./app
   ├─ load connectToDB from ./config/db
   ├─ set PORT from process.env.PORT || 3000
   ├─ connectToDB()
   │  └─ mongoose.connect(process.env.MONGODB_URI)
   └─ app.listen(PORT)
      └─ app.js registrations already in place
         ├─ express.json()
         ├─ cors()
         ├─ requestLogger
         ├─ app.use("/api/v1", v1Router)
         └─ GET / health check
```

## Full Request Lifecycle

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant G as Global middleware
  participant V as routes/v1.js
  participant Q as modules/quiz/index.js
  participant A as userAuth
  participant H as asyncHandler
  participant Ctrl as QuizController.createQuiz
  participant S as QuizService.createQuiz
  participant Joi as quiz/joiSchema.js
  participant Repo as QuizRepository
  participant DB as MongoDB
  participant ER as utils/response.errorResponse

  C->>G: POST /api/v1/quiz
  G->>V: JSON body + headers
  V->>Q: /quiz router
  Q->>A: router.use(userAuth)
  A->>DB: find user by JWT id
  DB-->>A: user document
  A-->>Q: next()
  Q->>H: asyncHandler(createQuiz)
  H->>Ctrl: call controller
  Ctrl->>S: createQuiz(req.user.id, req.body)
  S->>Joi: createQuizSchema.validate(body)
  Joi-->>S: validated value
  S->>Repo: createQuiz(quizData)
  Repo->>DB: insert quiz document
  DB-->>Repo: saved quiz
  Repo-->>S: populated quiz
  S-->>Ctrl: quiz payload
  Ctrl-->>C: successResponse(201,...)
  alt service throws or repository throws
    S-->>H: rejected promise
    H->>ER: errorResponse(res, err)
    ER-->>C: { statusCode, message, timestamp }
  end
```

## Global Middleware Pipeline

| # | Middleware | Why it is there |
| --- | --- | --- |
| 1 | `express.json()` | Parses JSON request bodies for controllers and services. |
| 2 | `cors()` | Allows cross-origin requests from browser clients. |
| 3 | `requestLogger` | Logs method and URL and sets the `X-Powered-By` response header. |

## Per-Route Middleware

The module routers apply authentication at the router level and then wrap controller methods with `asyncHandler`.

```js
// modules/quiz/index.js
router.use(userAuth)
router.post("/", asyncHandler(controller.createQuiz))
router.post("/:quizId/attempt", asyncHandler(controller.submitAttempt))
```

- `userAuth` runs before every quiz, MCQ, master, and performance endpoint.
- `asyncHandler` catches rejected promises from controllers and forwards them to `utils/response.errorResponse`.
- Validation is not applied as Express middleware; the services and one controller validate with Joi inside the handler path.
- There is no upload middleware and no rate limiting middleware in the current code.

## Full Middleware Catalog

| Middleware | File | Purpose | Applied where |
| --- | --- | --- | --- |
| `requestLogger` | `middlewares/requestLogger.js` | Logs requests and adds a custom response header. | Globally in `app.js`. |
| `asyncHandler` | `middlewares/asyncHandler.js` | Wraps async handlers and sends errors to `errorResponse`. | All module routes that use it. |
| `userAuth` | `middlewares/auth.js` | Verifies JWTs, loads the user, and attaches `req.user`. | `user`, `master`, `mcq`, `quiz`, and `performance` routers. |
| `adminAuth` | `middlewares/auth.js` | Blocks non-admin users. | Defined in code, but not currently mounted on any route. |

## Error Handling Flow

```mermaid
flowchart TD
  A["Route handler throws or rejects"] --> B["asyncHandler catches rejection"]
  B --> C["utils/response.errorResponse"]
  C --> D["JSON error response<br/>{ statusCode, message, timestamp }"]

  E["userAuth token missing / invalid / inactive user"] --> F["inline 401 / 403 response via successResponse"]
  G["Joi validation failure inside controller or service"] --> C
  H["CustomError thrown in service"] --> C
  I["Generic error object"] --> C
```

Notes:

- The code does not define a separate Express 404 middleware or central `app.use((err, req, res, next) => ...)` error handler.
- The code does not contain Sequelize-specific normalization because the project uses Mongoose, not Sequelize.
- JWT verification failures are handled inline in `middlewares/auth.js` and return a 401 response directly.

## Response Envelopes

| Outcome | Shape |
| --- | --- |
| Success with data | `successResponse(statusCode, data, message)` returns `{ statusCode, data, message }`. |
| Success with message only | `successResponse(statusCode, null, message)` returns the same envelope with `data: null`. |
| Error / fail | `errorResponse(res, err)` returns `{ statusCode, message, timestamp }`. Some middleware paths return `{ statusCode, data: null, message }` directly. |

