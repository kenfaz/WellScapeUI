const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const port = Number(process.env.PORT) || 3000;
const dataDirectory = path.join(__dirname, 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const database = new DatabaseSync(path.join(dataDirectory, 'wellspace.sqlite'));
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
    sleep REAL NOT NULL CHECK (sleep BETWEEN 0 AND 12),
    water INTEGER NOT NULL CHECK (water BETWEEN 0 AND 16),
    activity INTEGER NOT NULL CHECK (activity BETWEEN 0 AND 1440),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const listCheckins = database.prepare(`
  SELECT id, date, mood, sleep, water, activity, note
  FROM checkins
  ORDER BY date ASC, id ASC
`);
const insertCheckin = database.prepare(`
  INSERT INTO checkins (date, mood, sleep, water, activity, note)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const findCheckin = database.prepare(`
  SELECT id, date, mood, sleep, water, activity, note
  FROM checkins
  WHERE id = ?
`);
const updateCheckin = database.prepare(`
  UPDATE checkins
  SET date = ?, mood = ?, sleep = ?, water = ?, activity = ?, note = ?
  WHERE id = ?
`);

function isValidCheckin({ date, mood, sleep, water, activity, note }) {
  const dateValue = typeof date === 'string' ? new Date(`${date}T00:00:00.000Z`) : null;
  const validDate = dateValue && !Number.isNaN(dateValue.getTime()) && dateValue.toISOString().slice(0, 10) === date;
  const validMood = Number.isInteger(mood) && mood >= 1 && mood <= 5;
  const validSleep = Number.isFinite(sleep) && sleep >= 0 && sleep <= 12 && Number.isInteger(sleep * 2);
  const validWater = Number.isInteger(water) && water >= 0 && water <= 16;
  const validActivity = Number.isInteger(activity) && activity >= 0 && activity <= 1440;
  const validNote = typeof note === 'string' && note.length <= 240;
  return Boolean(validDate && validMood && validSleep && validWater && validActivity && validNote);
}

app.use(express.json({ limit: '8kb' }));

app.get('/', (_request, response) => response.redirect('/check-in'));
app.get('/check-in', (_request, response) => response.sendFile(path.join(__dirname, 'checkin.html')));
app.get('/dashboard', (_request, response) => response.sendFile(path.join(__dirname, 'index.html')));

for (const asset of ['style.css', 'script.js', 'checkin.js']) {
  app.get(`/${asset}`, (_request, response) => response.sendFile(path.join(__dirname, asset)));
}

app.get('/api/checkins', (_request, response) => {
  response.json(listCheckins.all());
});

app.get('/api/checkins/:id', (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return response.status(400).json({ error: 'Invalid check-in ID.' });

  const record = findCheckin.get(id);
  if (!record) return response.status(404).json({ error: 'Check-in not found.' });
  return response.json(record);
});

app.post('/api/checkins', (request, response) => {
  const checkin = request.body || {};
  if (!isValidCheckin(checkin)) {
    return response.status(400).json({ error: 'Check the date and wellness values, then try again.' });
  }

  const { date, mood, sleep, water, activity, note } = checkin;
  const result = insertCheckin.run(date, mood, sleep, water, activity, note);
  return response.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.put('/api/checkins/:id', (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return response.status(400).json({ error: 'Invalid check-in ID.' });
  if (!findCheckin.get(id)) return response.status(404).json({ error: 'Check-in not found.' });

  const checkin = request.body || {};
  if (!isValidCheckin(checkin)) {
    return response.status(400).json({ error: 'Check the date and wellness values, then try again.' });
  }

  const { date, mood, sleep, water, activity, note } = checkin;
  updateCheckin.run(date, mood, sleep, water, activity, note, id);
  return response.json({ id });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`WELLSPACE is running at http://127.0.0.1:${port}`);
});