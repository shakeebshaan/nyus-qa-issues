// bug-hunt tick 2026-07-08 #10: coach chat core (socket lifecycle, send pipeline, history)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const now = new Date().toISOString();
const base = {
  createdAt: now,
  status: 'open',
  fix: null,
  history: [],
  author: 'shakeebshaan',
  tags: ['bug-hunt', 'auto'],
  imagePath: null,
  imageCommit: null,
  imagePaths: [],
  imageCommits: [],
  imagePrivate: false,
};

const issues = [
  {
    ...base,
    id: 'i-20260708-7ff8',
    route: '/coach-chat',
    description:
      "[bug-hunt] Socket auto-reconnect always retries with the STALE token captured at connect time - the pre-reconnect token-refresh hook is dead code listening on the wrong emitter. chat.service.ts:168 registers `this.socket.on('reconnect_attempt', ...)` (refreshes the access token and swaps socket.auth + query.token before each retry), but in socket.io-client v4 (repo ships 4.8.3) reconnect lifecycle events are emitted ONLY on the Manager - `socket.io.on('reconnect_attempt')`; the Socket instance never receives them (verified: node_modules/socket.io-client/build/cjs/manager.js:379 is the sole emitter, socket.js re-emits nothing). Expected: each reconnect attempt carries a freshly-rotated token, as the code comment states. Actual: after any network blip the manager retries with the ORIGINAL token from the connect() closure; if the token was refreshed/expired/revoked meanwhile, the backend connect handler rejects every attempt ('Authentication failed.' + disconnect, backend.py:14382), all 10 reconnectionAttempts burn, and the app-wide singleton socket stays dead for the session (chat deltas, image_ready, streak_update, partner events) until an app-foreground or chat-page mount calls connect() again. Repro (static + empirical): attach both listeners and drop the network - the Manager listener fires per attempt, the Socket listener never does. Fix: one line - register the handler on this.socket.io instead of this.socket. File: src/services/chat.service.ts:165-180.",
  },
  {
    ...base,
    id: 'i-20260708-aa69',
    route: '/coach-chat',
    description:
      "[bug-hunt] After the socket's 'Authentication failed.' recovery reconnect, an OPEN coach-chat screen goes permanently deaf: incoming AI replies never render (while the unread badge lights up), the typing indicator freezes, and the polling fallback never engages. Chain: handleSocketError (chat.service.ts:361) on 'Authentication failed.' refreshes the token, then calls this.disconnect() + this.connect(userId). disconnect() (1) nulls the single-slot callbacks newMessageCallback / aiTypingCallback / errorCallback (chat.service.ts:256-258), which are only registered by useChatSocket's mount effect - a service-internal reconnect re-runs no React effect, so they stay null; and (2) detaches the socket 'disconnect' handler BEFORE calling socket.disconnect() (line 242 vs 254), so disconnectCallbacks never fire, useChatSocket's isSocketConnected stays true, and CoachChat's 60s polling fallback (CoachChat.tsx:104-108) never turns on. Net effect: new_message events still reach handleNewMessage, which sets nyus_has_unread_coach - the user sits INSIDE the chat watching an unread badge appear while no bubble renders, until they leave and re-enter the page. Ironically the comment at chat.service.ts:259-265 preserves the connect/disconnect REGISTRIES for exactly this code path but misses the single-slot callbacks two lines above it. Trigger is real: access-token rotation/expiry mid-session or a token_version bump (owner login) makes the backend reject the socket handshake with 'Authentication failed.'; the refresh then succeeds and the recovery path runs. Expected: after the internal recovery reconnect, the open chat keeps receiving messages (or at minimum the polling fallback engages). Fix: snapshot + restore the callback slots across the auth-recovery reconnect (or convert them to multi-subscriber registries like connectCallbacks), and invoke disconnectCallbacks on teardown. Files: src/services/chat.service.ts:235-270 + 361-382, src/pages/_components/coach-chat/hooks/useChatSocket.ts:57-141.",
  },
  {
    ...base,
    id: 'i-20260708-1898',
    route: '/coach-chat',
    description:
      "[bug-hunt] Coach chat history is hard-capped at the newest 30 messages - older conversation is permanently unreachable in the UI. CoachChat.tsx:91 fetches chatService.getHistory({ limit: 30 }) once; nothing in the app ever passes before_id (ChatHistoryRequest.before_id has zero UI callers) and the message list has no top-reached loader (no loadMore/fetchNext/hasMore anywhere under coach-chat components or CoachChatMessageList). Scrolling to the top just dead-ends at the 30th-newest message. Since the AI answers every user message and also sends proactive messages, an active user exceeds 30 rows within a day or two - yesterday's plan discussion and coach advice silently vanish. Expected: reaching the top loads older messages (standard chat pattern) - the backend already supports it twice over: /coach/history has page+limit pagination and returns total (app/routes/coach.py:481-490), and legacy /chat/history supports before_id (backend.py:3882-3883). Gotcha for the fix: the FE service plumbs before_id (chat.service.ts:50-52) but the PRIMARY /coach/history endpoint ignores that param entirely (it is page-based) - wiring before_id through without touching the backend would silently re-fetch page 1; use page= against /coach/history or add before_id support server-side. Files: src/pages/CoachChat.tsx:89-97, src/services/chat.service.ts:47-58, src/components/coach/CoachChatMessageList.tsx.",
  },
];

db.issues = [...issues, ...db.issues];
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n', 'utf8');
console.log('filed', issues.map((i) => i.id).join(', '), 'total issues:', db.issues.length);
