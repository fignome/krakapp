import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCejgFrfuCifaHfe1ehtPSbQdQeE_sNYC4",
  authDomain: "krakapp-ad9f1.firebaseapp.com",
  projectId: "krakapp-ad9f1",
  storageBucket: "krakapp-ad9f1.firebasestorage.app",
  messagingSenderId: "631398525088",
  appId: "1:631398525088:web:6497117817c9d2289441c5",
  measurementId: "G-R1FJB8YWSP",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
