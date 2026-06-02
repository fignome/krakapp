// Run: node scripts/seedFirestore.js
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCejgFrfuCifaHfe1ehtPSbQdQeE_sNYC4",
  authDomain: "krakapp-ad9f1.firebaseapp.com",
  projectId: "krakapp-ad9f1",
  storageBucket: "krakapp-ad9f1.firebasestorage.app",
  messagingSenderId: "631398525088",
  appId: "1:631398525088:web:6497117817c9d2289441c5",
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// ─── Poll ──────────────────────────────────────────────────────────────────────
async function seedPoll() {
  await setDoc(doc(db, 'polls', 'current'), {
    question: "Who was the Kraken's best player in 2025-26?",
    options: ['Jordan Eberle', 'Vince Dunn', 'Brandon Montour', 'Chandler Stephenson', 'Joey Daccord'],
    votes: {
      'Jordan Eberle': 312,
      'Vince Dunn': 287,
      'Brandon Montour': 198,
      'Chandler Stephenson': 143,
      'Joey Daccord': 167,
    },
  })
  console.log('✓ Poll seeded')
}

// ─── Player ratings ────────────────────────────────────────────────────────────
const RATINGS = {
  '8477955': { total: 756, votes: 92 },   // Jared McCann
  '8478407': { total: 812, votes: 95 },   // Vince Dunn
  '8477986': { total: 798, votes: 93 },   // Brandon Montour
  '8482665': { total: 714, votes: 90 },   // Matty Beniers
  '8474586': { total: 780, votes: 94 },   // Jordan Eberle
  '8476905': { total: 738, votes: 91 },   // Chandler Stephenson
  '8478916': { total: 760, votes: 92 },   // Joey Daccord
  '8481554': { total: 696, votes: 88 },   // Kaapo Kakko
  '8480009': { total: 704, votes: 89 },   // Eeli Tolvanen
  '8484800': { total: 672, votes: 87 },   // Berkly Catton
  '8483524': { total: 648, votes: 85 },   // Shane Wright
  '8476457': { total: 660, votes: 86 },   // Adam Larsson
  '8479324': { total: 620, votes: 83 },   // Ryan Lindgren
  '8475768': { total: 574, votes: 79 },   // Jaden Schwartz
  '8476467': { total: 590, votes: 80 },   // Jamie Oleksiak
}

async function seedRatings() {
  for (const [id, data] of Object.entries(RATINGS)) {
    await setDoc(doc(db, 'ratings', id), data)
    console.log(`  ✓ Rating seeded: ${id} (avg ${(data.total / data.votes).toFixed(1)})`)
  }
  console.log('✓ All ratings seeded')
}

async function main() {
  console.log('\nSeeding Firestore…')
  await seedPoll()
  await seedRatings()
  console.log('\nDone.\n')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
