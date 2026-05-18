function initRotary(id) {
    const canvas = document.getElementById('canvas-rotary');
const ctx = canvas.getContext('2d');

const config = {
    count: 4,          // Number of cylinders
    radius: 60,        // How "deep" the cylinder is
    fontSize: 40,
    spacing: 70,       // Gap between cylinders
    yOffset: 150       // Vertical center of the lock
};

let rotations = Array(config.count).fill(0);
let targets = Array(config.count).fill(0);

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < config.count; i++) {
        // Smooth interpolation
        rotations[i] += (targets[i] - rotations[i]) * 0.1;

        const x = 50 + (i * config.spacing);
        const angleStep = (Math.PI * 2) / 10;

        for (let n = 0; n < 10; n++) {
            const itemAngle = (n * angleStep) - rotations[i];
            const cos = Math.cos(itemAngle);

            // 1. BACKFACE CULLING: Only draw if it's on the front side
            if (cos > 0) {
                const y = config.yOffset + Math.sin(itemAngle) * config.radius;
                
                // 2. PERSPECTIVE SQUISH: Use cosine to flatten the text height
                const verticalScale = cos; 

                ctx.save();
                ctx.translate(x, y);
                ctx.scale(1, verticalScale); // Squish the height, keep width 1:1

                ctx.font = `bold ${config.fontSize}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Solid color, no fading
                ctx.fillStyle = '#222'; 
                ctx.fillText(n, 0, 0);
                
                ctx.restore();
            }
        }
    }

    // 3. SELECTION GUIDES: Draw two lines to show the "active" row
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, config.yOffset - 25); ctx.lineTo(canvas.width, config.yOffset - 25);
    ctx.moveTo(0, config.yOffset + 25); ctx.lineTo(canvas.width, config.yOffset + 25);
    ctx.stroke();

    requestAnimationFrame(draw);
}

// Click to rotate the specific cylinder
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Determine which cylinder index was clicked
    const clickedIdx = Math.floor((mouseX - 15) / config.spacing);
    
    if (clickedIdx >= 0 && clickedIdx < config.count) {
        targets[clickedIdx] += (Math.PI * 2) / 10;
    }
});

draw();
}
initRotary();