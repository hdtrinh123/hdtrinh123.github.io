// Shared canvas, drawing context and small math helpers used by every other file.
const canvas = document.getElementById('gameCanvas');
/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext('2d');
const [canvasWidth, canvasHeight] = [canvas.width, canvas.height]

const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

function dot(ax,ay,bx,by){
    return ax*bx+ay*by
}
