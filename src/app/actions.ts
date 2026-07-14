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
  id: string; // The email or UID
  email: string;
  name: string;
  uid: string;
  approved: boolean;
  createdAt: string;
  approvedAt?: string;
  expiresAt?: string;
  routerCount: number;
  maxRouters?: number;
  quota?: string;
}

// Helper to parse Firestore dates safely
function parseFirestoreDate(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  } else if (value.seconds) {
    return new Date(value.seconds * 1000).toISOString();
  } else {
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    } catch (e) {}
    return String(value);
  }
}

// Action to fetch all users
export async function getUsers(): Promise<UserDoc[]> {
  if (!(await isAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const database = verifyDb();

  try {
    // 1. Fetch routers to aggregate ownership count
    const routersSnapshot = await database.collection('routers').get();
    const routerOwnersMap: { [email: string]: number } = {};

    routersSnapshot.forEach((doc) => {
      const data = doc.data();
      const owner = (data.owner || '').toLowerCase().trim();
      const owners = Array.isArray(data.owners) 
        ? data.owners.map((e: any) => String(e).toLowerCase().trim()) 
        : [];
      
      const uniqueEmails = new Set<string>();
      if (owner) uniqueEmails.add(owner);
      owners.forEach((e) => {
        if (e) uniqueEmails.add(e);
      });

      uniqueEmails.forEach((email) => {
        routerOwnersMap[email] = (routerOwnersMap[email] || 0) + 1;
      });
    });

    // 2. Fetch users
    const snapshot = await database.collection('users').get();
    const users: UserDoc[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const userEmail = (data.email || doc.id).toLowerCase().trim();
      const routerCount = routerOwnersMap[userEmail] || 0;

      const createdAtStr = parseFirestoreDate(data.createdAt) || new Date().toISOString();
      const approvedAtStr = parseFirestoreDate(data.approvedAt);
      const expiresAtStr = parseFirestoreDate(data.expiresAt);

      const maxRoutersVal = data.maxRouters !== undefined ? parseInt(data.maxRouters, 10) : undefined;
      const quotaVal = data.quota !== undefined ? String(data.quota) : undefined;

      users.push({
        id: doc.id,
        email: data.email || doc.id,
        name: data.name || 'Unnamed User',
        uid: data.uid || '',
        approved: !!data.approved,
        createdAt: createdAtStr,
        approvedAt: approvedAtStr,
        expiresAt: expiresAtStr,
        routerCount,
        maxRouters: maxRoutersVal,
        quota: quotaVal,
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
export async function approveUser(email: string, expiresAt?: string, maxRouters?: number, quota?: string) {
  if (!(await isAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const database = verifyDb();
  const docId = email.toLowerCase().trim();
  try {
    const updateData: any = {
      approved: true,
      approvedAt: new Date(),
    };
    if (expiresAt) {
      updateData.expiresAt = new Date(expiresAt);
    } else {
      updateData.expiresAt = null;
    }
    if (maxRouters !== undefined) {
      updateData.maxRouters = maxRouters;
    }
    if (quota !== undefined) {
      updateData.quota = quota;
    }
    await database.collection('users').doc(docId).update(updateData);
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
      expiresAt: null,
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
export async function addUser(name: string, email: string, approved: boolean, expiresAt?: string, maxRouters?: number, quota?: string) {
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

    const userData: any = {
      uid: 'manual_' + Math.random().toString(36).substring(2, 11),
      email: docId,
      name: name.trim(),
      approved: approved,
      createdAt: new Date(),
    };

    if (approved) {
      userData.approvedAt = new Date();
      userData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    } else {
      userData.expiresAt = null;
    }

    if (maxRouters !== undefined) {
      userData.maxRouters = maxRouters;
    }

    if (quota !== undefined) {
      userData.quota = quota;
    }

    await userDocRef.set(userData);
    return { success: true };
  } catch (error: any) {
    console.error('Error adding user:', error);
    throw new Error(`Failed to add user: ${error.message}`);
  }
}

// Action to update user details
export async function updateUser(email: string, name: string, approved: boolean, expiresAt?: string, maxRouters?: number, quota?: string) {
  if (!(await isAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const database = verifyDb();
  const docId = email.toLowerCase().trim();
  try {
    const docSnap = await database.collection('users').doc(docId).get();
    if (!docSnap.exists) {
      throw new Error('User not found');
    }
    const currentData = docSnap.data() || {};
    const wasApproved = !!currentData.approved;

    const updateData: any = {
      name: name.trim(),
      approved: approved,
    };

    if (approved) {
      if (!wasApproved) {
        updateData.approvedAt = new Date();
      }
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    } else {
      updateData.expiresAt = null;
    }

    if (maxRouters !== undefined) {
      updateData.maxRouters = maxRouters;
    }

    if (quota !== undefined) {
      updateData.quota = quota;
    }

    await database.collection('users').doc(docId).update(updateData);
    return { success: true };
  } catch (error: any) {
    console.error(`Error updating user ${email}:`, error);
    throw new Error(`Failed to update user: ${error.message}`);
  }
}
