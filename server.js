const express = require('express');
const http    = require('http');
const path    = require('path');
const { WebSocketServer } = require('ws');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: '/buzz-ws' });
const PORT   = process.env.PORT || 3000;

// ── Buzzer session state ──────────────────────────────────────────────────────
// sessions: Map<sessionId, { clients: Set<ws>, winner: obj|null }>
const sessions = new Map();

function getSession(sid) {
  if (!sessions.has(sid)) sessions.set(sid, { clients: new Set(), winner: null });
  return sessions.get(sid);
}

function broadcast(session, msg) {
  const payload = JSON.stringify(msg);
  session.clients.forEach(ws => { if (ws.readyState === 1) ws.send(payload); });
}

wss.on('connection', (ws, req) => {
  const params  = new URL(req.url, 'http://localhost').searchParams;
  const sid     = params.get('s') || 'default';
  const session = getSession(sid);
  session.clients.add(ws);

  // Send current state immediately
  ws.send(JSON.stringify({ type: 'state', winner: session.winner }));

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'buzz' && !session.winner) {
        session.winner = { name: msg.name || 'Player', team: msg.team || 'Team', time: Date.now() };
        broadcast(session, { type: 'buzzed', winner: session.winner });
      } else if (msg.type === 'reset') {
        session.winner = null;
        broadcast(session, { type: 'reset' });
      }
    } catch (e) {}
  });

  ws.on('close', () => session.clients.delete(ws));

  // Prune empty sessions after a delay
  ws.on('close', () => {
    setTimeout(() => {
      if (sessions.has(sid) && sessions.get(sid).clients.size === 0) sessions.delete(sid);
    }, 60000);
  });
});

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// Clean URL routing (matches Vercel cleanUrls:true behaviour)
['play', 'builder', 'library', 'buzzer'].forEach(page => {
  app.get('/' + page, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', page + '.html'));
  });
});

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => console.log(`Jeopardy app running on port ${PORT}`));
