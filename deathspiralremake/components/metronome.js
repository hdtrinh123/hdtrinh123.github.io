export const metronome ={
    songtime:0,
    update(dt) {
        this.songtime+=(chart.bpm / 60000) * dt
    }
}