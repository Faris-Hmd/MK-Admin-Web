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

async function checkUsers() {
  const snapshot = await db.collection('users').get();
  console.log(`Found ${snapshot.size} users:`);
  snapshot.forEach(doc => {
    console.log(`Doc ID: ${doc.id} | email field: ${doc.data().email} | uid field: ${doc.data().uid} | name field: ${doc.data().name} | approved: ${doc.data().approved}`);
  });
}

checkUsers();
