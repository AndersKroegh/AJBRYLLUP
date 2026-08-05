// Engangs-seed: skriver standardindholdet (Anders & Julie osv.) til Firestore
// og OVERSKRIVER det gamle dokument, som ellers vinder over koden.
//
// Kør:  npm run seed
//
// Kræver at Firestore-reglerne er udgivet (så anonym skrivning er tilladt)
// og at anonym login er slået til i Firebase-projektet.

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { firebaseConfig, appId, DEFAULT_DATA } from '../src/weddingConfig.js';

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('→ Logger ind anonymt …');
  await signInAnonymously(auth);

  const ref = doc(db, 'artifacts', appId, 'public', 'data', 'wedding_info', 'main');
  console.log('→ Skriver standardindhold til:', ref.path);
  await setDoc(ref, DEFAULT_DATA); // overskriver hele dokumentet

  console.log(`✓ Færdig! Databasen viser nu "${DEFAULT_DATA.names}" – ${DEFAULT_DATA.date}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ Seed fejlede:', err?.code || err?.message || err);
  console.error('  Tjek at Firestore-reglerne er udgivet, og at anonym login er slået til.');
  process.exit(1);
});
