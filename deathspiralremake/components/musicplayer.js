export const musicPlayer = {
    song: null,
    bpm: 0,
    init(data){
        this.song = new Audio(data.audioPath)
        this.bpm = data.bpm
        console.log(this.song)
        console.log(data)
    },
    startPlayback() {
        this.song.play();
    },
    Pause(){
        this.song.pause()
    },
    getSongPositionInMs() {
        // Multiply by 1000 to convert seconds to milliseconds
        return this.song.currentTime * 1000; 
    },
    getCurrentBeat() {
        let positionInMs = this.song.currentTime * 1000;
        let msPerBeat = (60 / this.bpm) * 1000;
        return positionInMs / msPerBeat;
    }
}
