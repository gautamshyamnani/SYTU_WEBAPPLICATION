# Slice 11 — Notifications System

## What was added

### New files
| File | Purpose |
|---|---|
| `src/models/Notification.js` | MongoDB model — persists all notifications with compound indexes for fast user/unread queries |
| `src/controllers/notificationController.js` | GET (paginated, filter), PUT mark-read, PUT mark-all-read, DELETE |
| `src/routes/notifications.js` | `/api/notifications` REST routes, all protected |

### Rewritten (stub → real implementation)
| File | Before | After |
|---|---|---|
| `src/workers/notification.worker.js` | `console.log` placeholders | Persists to DB + emits `notification:new` via Socket.IO to online users |

### Surgically modified (minimal changes, nothing broken)
| File | Change |
|---|---|
| `src/config/socket.js` | Added `getIO()` singleton export; added notification job enqueue in `message:send`; pushes unread count on socket connect |
| `src/controllers/connectionController.js` | Added `addNotificationJob` calls in `sendRequest` and `respondToRequest` |
| `src/controllers/paymentController.js` | Added `addNotificationJob` call in `applyPremiumOnSuccess` |
| `src/app.js` | Mounted `/api/notifications` route |

---

## API Reference

All routes require `Authorization: Bearer <accessToken>`.

| Method | Route | Description |
|---|---|---|
| GET | `/api/notifications` | Get notifications, newest first |
| GET | `/api/notifications?unreadOnly=true` | Only unread notifications |
| GET | `/api/notifications?page=2&limit=10` | Paginated |
| PUT | `/api/notifications/read-all` | Mark ALL as read |
| PUT | `/api/notifications/:id/read` | Mark one as read |
| DELETE | `/api/notifications/:id` | Delete a notification |

### GET /api/notifications response shape
```json
{
  "success": true,
  "unreadCount": 5,
  "total": 42,
  "page": 1,
  "pages": 3,
  "notifications": [
    {
      "_id": "...",
      "userId": "...",
      "type": "connection_request",
      "message": "Jane Doe sent you a connection request",
      "referenceId": "<connectionId>",
      "isRead": false,
      "createdAt": "2026-06-27T14:00:00.000Z"
    }
  ]
}
```

---

## Notification types

| Type | Trigger | Message example |
|---|---|---|
| `connection_request` | `POST /api/connections/send/:userId` | "Jane sent you a connection request" |
| `connection_accepted` | `PUT /api/connections/respond/:id` with `action: accepted` | "Jane accepted your connection request" |
| `message` | `socket.emit('message:send', ...)` | "Jane sent you a message" |
| `payment` | Payment verified / webhook fires | "Your payment was successful! You are now a Premium member." |
| `system` | Manual / future use | Any system message |

---

## Real-time flow

```
Action (API call / socket event)
        │
        ▼
addNotificationJob(type, { userId, type, message, referenceId })
        │  (BullMQ — fire-and-forget, 3× retry with exponential backoff)
        ▼
notification.worker.js
   1. Notification.create({ userId, type, message, referenceId })
        │  ← always saved regardless of online/offline status
        ▼
   2. getSocketId(userId) → socketId?
        ├── online  → io.to(socketId).emit('notification:new', payload)
        └── offline → stored in DB; delivered via GET /api/notifications on next visit
```

## Socket events

### Server → Client

| Event | When | Payload |
|---|---|---|
| `notification:new` | When a notification is created and user is online | `{ id, type, message, referenceId, isRead, createdAt }` |
| `notification:unread_count` | On socket connect (if unread > 0) | `{ unreadCount }` |

### Client-side example
```js
socket.on('notification:new', (notification) => {
  // Show toast / increment badge
  console.log('New notification:', notification.message);
});

socket.on('notification:unread_count', ({ unreadCount }) => {
  // Update badge immediately on connect
  setBadge(unreadCount);
});
```

---

## Security

| Concern | Solution |
|---|---|
| Route protection | All `/api/notifications` routes behind `protect` middleware |
| Ownership on read/delete | `findOneAndUpdate({ _id, userId: req.user._id })` — returns 404 if not owner |
| Queue failures | `addNotificationJob` wrapped in `.catch()` — never crashes the originating request |
| Socket delivery failure | Caught and logged — DB record is always the source of truth |

---

## Edge case handling

| Case | Behaviour |
|---|---|
| User is offline | Notification saved to DB; delivered on next `GET /api/notifications` |
| Duplicate connection request re-sent | New notification queued (receiver sees the new request) |
| Payment webhook fires twice | `applyPremiumOnSuccess` is idempotent; second notification queued but user just sees two — acceptable |
| Invalid userId in job data | Worker logs a warning and returns `{ skipped: true }` — no retry |
| Socket.IO not yet initialized | `getIO()` throws; worker catches and logs — DB record still saved |
