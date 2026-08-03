let canvas = document.getElementById('canvas');
/** @type {CanvasRenderingContext2D} */
let ctx = canvas.getContext('2d');


import { chartManager } from "./components/chartmanager.js";
import { musicPlayer } from "./components/musicplayer.js";
import { input } from "./components/input.js";
import { display } from "./components/display.js";



let lastTime=0;
let deltaTime=0;
let marginbeats=0;
let lastnote=0
function gameLoop() {
    deltaTime=performance.now()-lastTime;
    //update(deltaTime); //Update first
    if(musicPlayer.song != null){
        // Catch up: advance past any notes whose whole hit window is behind us.
        while(chartManager.getCurrentnote && musicPlayer.getCurrentBeat()>chartManager.getCurrentnote.time+marginbeats){
            chartManager.advanceNote()
        }
    }
    display.update(deltaTime)
    display.draw(ctx)
    //draw(); //Then draw the updated state
    requestAnimationFrame(gameLoop);
    lastTime=performance.now();
}

async function start() {
    // Wait for the chart data to actually load before using it.
    let chart = await chartManager.loadLevel("./songs/example.json")
    musicPlayer.init({bpm:chart.bpm,audioPath:chart.music})
    let marginms = 80;
    let msPerBeat = (60 / musicPlayer.bpm) * 1000;
    marginbeats = marginms / msPerBeat;
    gameLoop();
}
start();


