import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getFirebaseAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin is not configured on the server.");
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export async function verifyFirebaseIdToken(idToken: string) {
  const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(idToken);
  const uid = typeof decoded.uid === "string" ? decoded.uid : typeof decoded.sub === "string" ? decoded.sub : null;
  if (!uid) throw new Error("Invalid Firebase identity.");
  return uid;
}
