// Firebase Configuration
// Replace these values with your own Firebase project config
// Get these from: Firebase Console > Project Settings > Your Apps > Web App

const firebaseConfig = {
  apiKey: "AIzaSyCMqNf2QnPiNFX9HKZrmFFDReXP9fiF9XU",
  authDomain: "multiplayer-world-d00b4.firebaseapp.com",
  databaseURL: "https://multiplayer-world-d00b4-default-rtdb.firebaseio.com",
  projectId: "multiplayer-world-d00b4",
  storageBucket: "multiplayer-world-d00b4.firebasestorage.app",
  messagingSenderId: "1020386598252",
  appId: "1:1020386598252:web:5f125e00fd6ed46b792749",
  measurementId: "G-7WYTVTMDW9"
};

// World Configuration
const WORLD_CONFIG = {
    width: 2000,
    height: 2000,
    materialCount: 50,
    respawnTime: 30000, // 30 seconds
    cursorUpdateRate: 50 // ms between cursor broadcasts
};

// Material Types
const MATERIAL_TYPES = [
    { type: 'stone', color: '#888888', weight: 40 },
    { type: 'wood', color: '#8B4513', weight: 35 },
    { type: 'metal', color: '#C0C0C0', weight: 20 },
    { type: 'crystal', color: '#a855f7', weight: 5 }
];
