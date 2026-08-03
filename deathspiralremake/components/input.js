export const input = {
    down:false
}

import { musicPlayer } from "./musicplayer.js";

document.addEventListener("keydown", (e) => {
    input.down = true
    if(e.code == "Space" && musicPlayer.song != null){
        musicPlayer.song.paused ? musicPlayer.startPlayback() : musicPlayer.Pause()
    }
});