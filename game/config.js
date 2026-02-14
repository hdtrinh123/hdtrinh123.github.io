// Firebase Configuration
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

// World
const WORLD = {
    width: 2400,
    height: 1200,
    viewWidth: 900
};

// Physics tuning
const PHYSICS = {
    playerRadius: 22,
    moveForce: 0.004,
    jumpSpeed: 10,
    maxSpeed: 7,
    friction: 0.5,
    restitution: 0.4,
    airFriction: 0.015,
    grabSpring: 0.00025,
    grabBreakDist: 250,
    grabRest: 60,
    coyoteFrames: 8
};

// Sync
const SYNC_RATE = 50; // ms between broadcasts

// Player colors
const PLAYER_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
];
