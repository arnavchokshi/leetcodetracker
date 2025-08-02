import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

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