import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyB5jpXiqYtH8kkRWqG36ufyBX2ebBqsBrE",
  authDomain: "leetcode-f3f3a.firebaseapp.com",
  databaseURL: "https://leetcode-f3f3a-default-rtdb.firebaseio.com",
  projectId: "leetcode-f3f3a",
  storageBucket: "leetcode-f3f3a.firebasestorage.app",
  messagingSenderId: "947350011221",
  appId: "1:947350011221:web:451c0651e1c282afe383dc",
  measurementId: "G-52R997EVEV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);

// Add error handling for Firebase connection
if (typeof window !== 'undefined') {
  // Only run in browser environment
  const connectedRef = ref(database, '.info/connected');
  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      console.log('Connected to Firebase');
    } else {
      console.log('Disconnected from Firebase');
    }
  });
} 