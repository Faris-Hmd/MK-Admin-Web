const fs = require('fs');
const admin = require('firebase-admin');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) { value = value.slice(1, -1); }
    env[key] = value.replace(/\\n/g, '\n');
  }
});

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY,
  })
});

const db = admin.firestore();

async function checkRouters() {
  const snapshot = await db.collection('routers').get();
  console.log(`Found ${snapshot.size} routers:`);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`Router ID: ${doc.id} | Name: ${data.name} | Owner: ${data.owner} | User: ${data.user}`);
  });
}

checkRouters();
