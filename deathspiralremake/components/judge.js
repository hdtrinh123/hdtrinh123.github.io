export const judge = {
    check(){
        if(chartManager.getCurrentnote && musicPlayer.getCurrentBeat()>chartManager.getCurrentnote.time-marginbeats){
            if(!musicPlayer.song.paused && lastnote!=chartManager.getCurrentnote){
                console.log(chartManager.getCurrentnote)
                lastnote=chartManager.getCurrentnote
                display.flash()
            }
        }
    }
}