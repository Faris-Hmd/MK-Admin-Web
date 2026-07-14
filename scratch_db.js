const fs = require('fs');
const admin = require('firebase-admin');

// Parse .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
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

async function inspectDb() {
  try {
    const collections = await db.listCollections();
    console.log('Collections:', collections.map(c => c.id));
    
    for (const coll of collections) {
      console.log(`\n--- Collection: ${coll.id} ---`);
      const snapshot = await coll.limit(1).get();
      if (snapshot.empty) {
        console.log('  (No documents)');
      } else {
        const doc = snapshot.docs[0];
        console.log(`  Sample Document ID: ${doc.id}`);
        const data = doc.data();
        const summary = {};
        for (const [k, v] of Object.entries(data)) {
          if (Array.isArray(v)) {
            summary[k] = `Array of length ${v.length} [first item type: ${v[0] ? typeof v[0] : 'empty'}]`;
          } else if (v && typeof v === 'object' && v.toDate) {
            summary[k] = `Firestore Timestamp: ${v.toDate().toISOString()}`;
          } else if (v && typeof v === 'object') {
            summary[k] = `Object with keys: ${Object.keys(v).join(', ')}`;
          } else {
            summary[k] = `${typeof v}: ${String(v).substring(0, 50)}${String(v).length > 50 ? '...' : ''}`;
          }
        }
        console.log('  Fields structure:', JSON.stringify(summary, null, 2));
      }
    }
  } catch (err) {
    console.error('Error inspecting DB:', err);
  }
}

inspectDb();
