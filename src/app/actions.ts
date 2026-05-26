'use server';

import { cookies } from 'next/headers';
import { db } from '@/lib/firebase-admin';

// Helper to check authentication
async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin_secret_pass';
  return session?.value === expectedPassword;
}

// Helper to verify database is initialized
function verifyDb() {
  if (!db) {
    throw new Error(
      'Firestore database is not initialized. Please copy "web/.env.local.example" to "web/.env.local" and populate your Firebase Service Account credentials.'
    );
  }
  return db;
}

// Action to verify password and log in
export async function login(password: string) {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (password === expectedPassword) {
    const cookieStore = await cookies();
    cookieStore.set('admin_session', password, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    return { success: true };
  }
  return { error: 'Invalid admin password' };
}

// Action to log out
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  return { success: true };
}

// Action to check authentication status
export async function checkAuthStatus() {
  const auth = await isAuthenticated();
  return { authenticated: auth };
}

export interface UserDoc {
  id: string; // The email
  email: string;
  name: string;
  uid: string;
  approved: boolean;
  createdAt: string;
}

// Action to fetch all users
export async function getUsers(): Promise<UserDoc[]> {
  if (!(await isAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const database = verifyDb();

  try {
    const snapshot = await database.collection('users').get();
    const users: UserDoc[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      let dateStr = new Date().toISOString();
      if (data.createdAt) {
        if (typeof data.createdAt.toDate === 'function') {
          dateStr = data.createdAt.toDate().toISOString();
        } else if (data.createdAt.seconds) {
          dateStr = new Date(data.createdAt.seconds * 1000).toISOString();
        } else {
          dateStr = new Date(data.createdAt).toISOString();
        }
      }

      users.push({
        id: doc.id,
        email: data.email || doc.id,
        name: data.name || 'Unnamed User',
        uid: data.uid || '',
        approved: !!data.approved,
        createdAt: dateStr,
      });
    });

    // Sort: Pending (unapproved) users first, then by name
    return users.sort((a, b) => {
      if (a.approved !== b.approved) {
        return a.approved ? 1 : -1; // unapproved (false) first
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    throw new Error(`Failed to fetch users: ${error.message}`);
  }
}

// Action to approve user
export async function approveUser(email: string) {
  if (!(await isAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const database = verifyDb();

  const docId = email.toLowerCase().trim();
  try {
    await database.collection('users').doc(docId).update({
      approved: true,
    });
    return { success: true };
  } catch (error: any) {
    console.error(`Error approving user ${email}:`, error);
    throw new Error(`Failed to approve user: ${error.message}`);
  }
}

// Action to revoke approval
export async function revokeUser(email: string) {
  if (!(await isAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const database = verifyDb();

  const docId = email.toLowerCase().trim();
  try {
    await database.collection('users').doc(docId).update({
      approved: false,
    });
    return { success: true };
  } catch (error: any) {
    console.error(`Error revoking user ${email}:`, error);
    throw new Error(`Failed to revoke user: ${error.message}`);
  }
}

// Action to delete a user
export async function deleteUser(email: string) {
  if (!(await isAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const database = verifyDb();

  const docId = email.toLowerCase().trim();
  try {
    await database.collection('users').doc(docId).delete();
    return { success: true };
  } catch (error: any) {
    console.error(`Error deleting user ${email}:`, error);
    throw new Error(`Failed to delete user: ${error.message}`);
  }
}

// Action to add a user manually
export async function addUser(name: string, email: string, approved: boolean) {
  if (!(await isAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const database = verifyDb();

  const docId = email.toLowerCase().trim();
  try {
    const userDocRef = database.collection('users').doc(docId);
    const docSnap = await userDocRef.get();

    if (docSnap.exists) {
      return { error: 'User with this email already exists' };
    }

    await userDocRef.set({
      uid: 'manual_' + Math.random().toString(36).substring(2, 11),
      email: docId,
      name: name.trim(),
      approved: approved,
      createdAt: new Date(), // Stored as standard JS Date which Firestore translates to Timestamp
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error adding user:', error);
    throw new Error(`Failed to add user: ${error.message}`);
  }
}

// Action to update user details
export async function updateUser(email: string, name: string, approved: boolean) {
  if (!(await isAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const database = verifyDb();

  const docId = email.toLowerCase().trim();
  try {
    await database.collection('users').doc(docId).update({
      name: name.trim(),
      approved: approved,
    });
    return { success: true };
  } catch (error: any) {
    console.error(`Error updating user ${email}:`, error);
    throw new Error(`Failed to update user: ${error.message}`);
  }
}
