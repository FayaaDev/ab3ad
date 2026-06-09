import fs from 'node:fs/promises';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'data', 'db.json');
const raw = await fs.readFile(dbPath, 'utf8');
const db = JSON.parse(raw);
if (!db.users.find((user) => user.id === 'demo-user')) {
  db.users.push({
    id: 'demo-user',
    email: 'demo@ab3ad.local',
    name: 'Demo User',
    createdAt: new Date().toISOString(),
  });
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
}
console.log('Seeded demo user.');
