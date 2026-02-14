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

// Ragdoll body sizes
const RAG = {
    head: 11,
    torso: 15,
    arm: 7,
    leg: 8
};

// Physics tuning
const PHYSICS = {
    moveForce: 0.003,
    jumpSpeed: 8,
    maxSpeed: 6,
    coyoteFrames: 8,
    armForce: 0.0006,
    armMax: 0.005,
    legForce: 0.0002,
    grabDragForce: 0.00035,
    grabMaxForce: 0.008,
    grabReach: 55,
    grabBreakDist: 180,
    remoteSpring: 0.003,
    remoteDamp: 0.85
};

// Sync
const SYNC_RATE = 50;

// Player colors
const PLAYER_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
];
