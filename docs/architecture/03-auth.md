# Authentication & Access Control

[← Back to System Architecture](../system-architecture.md)

## Roles at a Glance

| Role | Who | How they authenticate | Token/session storage |
| --- | --- | --- | --- |
| `user` | Default registered account holder | JWT bearer token after login or OTP verification | JWT is returned in the response body; no server session store. |
| `admin` | User documents can carry `role: "admin"` | Same JWT flow as `user`, then `adminAuth` checks `req.user.role` | JWT is returned in the response body; no separate admin session store. |

## Login / Signup Flows

### Register and Verify OTP

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant Ctrl as UserController
  participant S as UserService
  participant R as UserRepository
  participant DB as MongoDB

  C->>Ctrl: POST /api/v1/user/register
  Ctrl->>S: registerUser(body)
  S->>R: findByEmail(email)
  R->>DB: query user
  S->>R: createUser or updateUserById
  R->>DB: save user + otp + expiry
  DB-->>R: saved user
  S-->>Ctrl: otp payload
  Ctrl-->>C: User registered
  C->>Ctrl: POST /api/v1/user/verify-otp
  Ctrl->>S: verifyOTP(email, otp)
  S->>R: findByEmail(email)
  S->>R: updateUserById(isVerified)
  S-->>Ctrl: token payload
  Ctrl-->>C: OTP verified successfully
```

### Login

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant Ctrl as UserController
  participant S as UserService
  participant R as UserRepository
  participant DB as MongoDB

  C->>Ctrl: POST /api/v1/user/login
  Ctrl->>S: loginUser({ email, password })
  S->>R: findByEmail(email)
  R->>DB: query user
  S->>S: bcrypt.compare(password, user.password)
  S-->>Ctrl: JWT payload
  Ctrl-->>C: User logged in
```

### Forgot Password

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant Ctrl as UserController
  participant S as UserService
  participant R as UserRepository
  participant DB as MongoDB

  C->>Ctrl: POST /api/v1/user/forgot-password
  Ctrl->>S: forgetPassword(email)
  S->>R: findByEmail(email)
  S->>R: updateOrCreateToken(userId, resetToken)
  R->>DB: save token document
  DB-->>R: token saved
  S-->>Ctrl: reset link payload
  Ctrl-->>C: Link sent via e-mail, Please check e-mail
```

### Reset Password

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant Ctrl as UserController
  participant S as UserService
  participant R as UserRepository
  participant DB as MongoDB

  C->>Ctrl: POST /api/v1/user/reset-password
  Ctrl->>S: resetPassword(token, password)
  S->>S: jwt.verify(token, JWT_SECRET)
  S->>R: findToken({ userId: decoded.id })
  R->>DB: load token document
  S->>R: findById(decoded.id)
  S->>S: bcrypt.hash(new password)
  S->>R: updateUserById(password hash)
  S->>R: deleteToken(tokenId)
  S-->>Ctrl: {}
  Ctrl-->>C: Password changed successfully
```

## Protecting a Request - `authMiddleware`

```mermaid
flowchart TD
  A["Authorization header"] --> B{"Starts with Bearer?"}
  B -- No --> C["401: Not authorized, no token"]
  B -- Yes --> D["Split token"]
  D --> E["jwt.verify(token, JWT_SECRET)"]
  E --> F["Load user by decoded.id"]
  E --> G["JWT error"]
  G --> H["401: Not authorized, token failed"]
  F --> I{"User found?"}
  I -- No --> J["401: Not authorized, user not found"]
  I -- Yes --> K{"user.active?"}
  K -- No --> L["403: Access denied, user is inactive"]
  K -- Yes --> M["req.user = user without password"]
  M --> N["next()"]
```

## Multi-Tenancy / Scoping

This codebase is not multi-tenant. It scopes records by `req.user.id` for ownership checks, but there is no tenant abstraction, tenant header, or tenant resolver.

For example, the MCQ and quiz services compare `mcq.user.toString()` or `quiz.user.toString()` against `userId` before allowing reads or mutations.

## Rate Limiting on Auth Endpoints

No rate limiting middleware is applied to auth routes in the current code.

