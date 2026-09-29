// Spin convention: positive vr = clockwise on screen (matches how canvas draws r).
//
// Applies surface friction where the ball touches something.
// (ox, oy) is the offset from the ball's center to the contact point, and
// (sx, sy) is the velocity of the surface being touched.
// Keep friction <= 0.5, otherwise it overshoots and reverses the slip.
function applyFriction(ball, ox, oy, sx, sy, friction) {
    // Direction along the surface (the way a clockwise spin moves the contact point)
    const tx = -oy / ball.size;
    const ty = ox / ball.size;

    // How fast the ball's surface slides across the other surface at the contact point:
    // ball movement + spin movement - surface movement
    const slip = (ball.vx - sx) * tx + (ball.vy - sy) * ty + ball.size * ball.vr;

    // Friction pushes against the slip. The same push changes both movement and spin.
    const impulse = -slip * friction;
    ball.vx += impulse * tx;
    ball.vy += impulse * ty;
    ball.vr += impulse / ball.size;
}
