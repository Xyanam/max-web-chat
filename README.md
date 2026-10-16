# MAX Web Chat

A minimal single-page web chat for the **MAX** messenger, built with React and the
[GREEN-API for MAX](https://green-api.com/max) HTTP API. The layout follows
[web.max.ru](https://web.max.ru/): a chat list in the sidebar and a conversation pane.

You can:

- connect a GREEN-API instance with `idInstance` / `apiTokenInstance`
- start a chat by phone number
- send text messages
- receive text replies through the HTTP API notification queue

## Technology stack

- React 19 + TypeScript
- Vite 8 (dev server and build)
- Vitest (unit tests), oxlint (linting)
- Plain CSS with light/dark themes. No UI framework and no runtime dependencies besides React.

## Prerequisites

- Node.js 20.19+ or 22.12+ (tested with Node 22.13) and npm
- A GREEN-API account with a **MAX** instance that is authorized (linked to your MAX account)
  in the [GREEN-API console](https://console.green-api.com/)
- A second MAX account (for example, a phone) to reply from

## Installation and running

```bash
npm install
npm run dev          # development server on http://localhost:5173
```

```bash
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build locally
```

Other checks:

```bash
npm test             # unit tests (Vitest)
npm run lint         # oxlint
npm run typecheck    # TypeScript
```

The UI starts without credentials. No `.env` file is needed: credentials are entered in the app.

## Required GREEN-API instance configuration

The app receives messages with the **HTTP API** method
([ReceiveNotification](https://green-api.com/v3/docs/api/receiving/technology-http-api/ReceiveNotification/)
→ [DeleteNotification](https://green-api.com/v3/docs/api/receiving/technology-http-api/DeleteNotification/)).
In the GREEN-API console, open the instance, click **Edit** (Изменить), and set:

| Setting | Value | Why |
|---|---|---|
| `webhookUrl` | **empty** | Notifications can't be fetched over HTTP API while a webhook URL is set. The app shows a dedicated error in this case. |
| Incoming messages (`incomingWebhook`) | on | Needed to receive replies |
| Outgoing message statuses (`outgoingWebhook`) | on (recommended) | Enables delivered/read/failed ticks |
| Messages sent from the phone / API | optional | Mirrors messages sent from other MAX clients or other API clients |

The instance must be in the `authorized` state. If it isn't, the app shows a banner.

## Usage

### 1. Connect

1. Open the app and enter **idInstance** and **apiTokenInstance** from the console.
2. **API URL** is filled in automatically as `https://{first 4 digits of idInstance}.api.green-api.com/v3`.
   If the console shows a different `apiUrl` for your instance, paste that value instead.
3. Optionally tick **Remember on this device**. See [Security](#security-considerations).
4. Click **Connect**. The app checks the credentials with
   [GetStateInstance](https://green-api.com/v3/docs/api/account/GetStateInstance/). Wrong credentials,
   network problems, and a non-authorized instance each produce a clear message.

To change or replace credentials, click the gear icon in the sidebar. **Save and reconnect** applies
new credentials. **Disconnect and forget credentials** returns to the connect screen.

### 2. Start a chat

Click the pencil icon or **New chat**, then enter the recipient's phone number. All of these work:
`+7 999 123-45-67`, `89991234567`, `9991234567`, or `+375 29 123-45-67`.

MAX does not use WhatsApp-style `79991234567@c.us` identifiers. The phone number is normalized to the
11–12 digit international format and sent to
[CheckAccount](https://green-api.com/v3/docs/api/service/CheckAccount/) (`{"phoneNumber": 79991234567}`).
That call returns the recipient's MAX `chatId` (e.g. `"10000000"`), and the app uses this `chatId`
for sending. Per the MAX API docs, only Russian (+7) and Belarusian (+375) numbers are accepted. If
the number has no MAX account, the app tells you.

### 3. Exchange messages

- Type a message and press **Enter** or the send button. **Shift+Enter** inserts a new line. Empty or
  whitespace-only messages can't be sent, and the limit is 4000 characters.
- Messages go out through
  [SendMessage](https://green-api.com/v3/docs/api/sending/SendMessage/):
  `POST {apiUrl}/waInstance{idInstance}/sendMessage/{apiTokenInstance}` with
  `Content-Type: application/json` and `{"chatId": "...", "message": "..."}`.
- Message states: clock = sending, ✓ = accepted by GREEN-API, ✓✓ = delivered, blue ✓✓ = read,
  red outline = failed (with the reason and a **Retry** link). A second send is blocked while a
  request is in flight.
- When the recipient replies in MAX, the reply appears in the matching chat. Messages from numbers
  without an open chat create a new chat in the sidebar with an unread badge.

## How receiving works

`src/api/notificationPoller.ts` runs this loop while you are connected:

1. `GET {apiUrl}/waInstance{id}/receiveNotification/{token}?receiveTimeout=20` (long polling, 5–60 s).
2. An empty response (`null`) means the queue is empty, so the loop polls again. It keeps at least 1 s
   between calls in case the server answers immediately.
3. A notification is parsed (`src/api/notifications.ts`) and **stored first**. The store saves to
   `localStorage` synchronously.
4. Only then is it acknowledged with `DELETE {apiUrl}/waInstance{id}/deleteNotification/{token}/{receiptId}`.
   - If the delete fails, GREEN-API serves the same notification again. Messages are de-duplicated by
     `idMessage`, so it is never shown twice.
   - Notifications that can't be processed are still deleted, so they can't block the FIFO queue.
5. Errors (network, 5xx, rate limits) back off 2 s → 4 s → … → 30 s. The sidebar footer shows the state.
6. The in-flight request is aborted and the loop stops on disconnect, on credential change, or when
   the component unmounts.

Supported notification types:

- `incomingMessageReceived`: incoming messages. `textMessage` and `extendedTextMessage` are shown as
  text. Images, video, audio, files, and other media appear as a labelled "not supported" placeholder,
  never as text; captions are not shown.
- `outgoingAPIMessageReceived` / `outgoingMessageReceived`: messages sent by this app, by other API
  clients, or from the phone. Messages this app already shows are merged by `idMessage`.
- `outgoingMessageStatus`: `delivered` / `read` / `failed` / `noAccount` / `notInGroup`. Statuses never
  move backwards.
- Other types (`stateInstanceChanged`, calls, …) and group chats (negative `chatId`) are acknowledged
  and skipped.

## Project structure

```
src/
  api/
    greenApi.ts            GREEN-API client (getStateInstance, checkAccount, sendMessage,
                           receiveNotification, deleteNotification) + error mapping
    notifications.ts       Pure parser for notification bodies
    notificationPoller.ts  Receive → process → delete loop with backoff and abort
    config.ts              API URL suggestion and validation
  state/chatReducer.ts     Chats and messages, de-duplication, ordering, status merging
  hooks/useChatStore.ts    Reducer + synchronous localStorage persistence
  lib/                     Phone normalization, storage, formatting helpers
  components/              ConnectScreen, Sidebar, ChatView, Composer, dialogs, …
  __tests__/               Vitest unit tests
```

## Security considerations

- No credentials are hardcoded, committed, or stored in `.env` files. `.gitignore` excludes `.env*`.
- The browser calls GREEN-API directly; GREEN-API allows CORS (`Access-Control-Allow-Origin: *`).
  The token is part of the request URL, as the API requires, so it is visible in the browser's
  network tab on this device.
- By default, credentials are kept in `sessionStorage` and cleared when the tab closes. **Remember on
  this device** moves them to `localStorage` until you click **Disconnect**. Any script running on the
  page origin can read either storage. That is acceptable for a local tool, but don't host this on a
  shared origin. In production, a backend proxy should hold the token.
- The app never logs credentials or notification payloads. Error messages shown to the user never
  include the request URL.
- Chat history (texts, names, phone numbers) is cached in `localStorage` per `idInstance`, so it
  survives reloads. Disconnecting forgets the credentials but keeps the history. To remove it, clear
  the site data in the browser.

## Known limitations

- **Not verified against a live MAX account.** Development had no real GREEN-API credentials.
  Requests and parsing follow the official documentation and are covered by unit tests. The UI was
  exercised in a browser with a stubbed `fetch`. Probing the real API with invalid credentials
  confirmed that it returns `401` with an empty body and allows CORS from `localhost`.
- The documentation calls the empty-queue response of `ReceiveNotification` only "empty". The app
  treats both `null` and an empty body as an empty queue.
- The default API URL pattern is inferred (the docs only say "take apiUrl from the console"). Paste
  the console value if it differs.
- One consumer per instance: the notification queue is shared. Two open tabs, or another bot polling
  the same instance, will split notifications between them.
- History comes only from this browser's cache and from notifications. Earlier messages from the GREEN-API
  journals are not loaded. Queued notifications are kept by GREEN-API for 24 hours.
- Text only: no media, groups, reactions, calls, etc., as the assignment requires.
- A delivery status that arrives before the `SendMessage` response (practically impossible, because
  delivery happens later) would be ignored.
- The free Developer plan allows 3 chats. MAX may restrict accounts that frequently check
  non-existent numbers (`CheckAccount`).

## Checks performed

- `npm run typecheck`, `npm run lint` (oxlint, 0 warnings), `npm run build`: pass.
- `npm test`: 49 unit tests pass, covering:
  - phone normalization: RU/BY formats, rejections, no `@c.us`
  - API client: exact URLs, methods, headers, and bodies for every method; `null` and empty queue;
    `receiveTimeout` clamping; 401/403/400-webhook/network error mapping without leaking the token
  - notification parser: incoming and outgoing text, `extendedTextMessage`, media as unsupported,
    groups ignored, status mapping
  - poller: process-before-delete, no delete when stopped mid-processing, handler errors don't block
    the queue, exponential backoff, abort on stop
  - reducer: de-duplication, chronological order, unread counters, merging an early
    `outgoingAPIMessageReceived` with the pending message, statuses never moving backwards
- Manual browser run (desktop and 375 px mobile, light and dark) with a stubbed `fetch`. Nothing was sent to
  GREEN-API. Covered:
  - required-field validation; 401 message
  - instance state shown after connecting
  - phone validation, unregistered number, and successful chat creation
  - Enter, Shift+Enter, and empty-message blocking
  - duplicate-submit blocking while a request is in flight
  - failed message with Retry
  - receiving a reply, a re-delivered duplicate (shown once), read status, an image (shown as
    unsupported, caption hidden), and a message from an unknown chat (new chat with unread badge)
  - all notifications deleted after processing
  - network failure → backoff → recovery
  - disconnect stops polling and clears the stored credentials
  - no console output containing credentials
