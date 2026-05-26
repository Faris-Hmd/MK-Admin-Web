import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // Handle newline characters in private key
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      console.log('Firebase Admin initialized successfully using service account.');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin with service account:', error);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      admin.initializeApp();
      console.log('Firebase Admin initialized using GOOGLE_APPLICATION_CREDENTIALS.');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin with Default Credentials:', error);
    }
  } else {
    console.warn(
      'Firebase Admin credentials not found. Please create web/.env.local and add your service account details.'
    );
  }
}

export const db =
  admin.apps.length > 0 &&
  (process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_APPLICATION_CREDENTIALS)
    ? admin.firestore()
    : null;

export default admin;
