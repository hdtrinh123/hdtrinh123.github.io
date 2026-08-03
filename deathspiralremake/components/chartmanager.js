import { musicPlayer } from "./musicplayer.js";
export const chartManager = {
    leveldata:null,
    _internalIndex:0,
    async loadLevel(jsonFilePath) {
        try {
            // 1. Fetch the single JSON file for the song
            const response = await fetch(jsonFilePath);
            this.leveldata = await response.json();

            return this.leveldata
            // 4. Start the game!
            //musicPlayer.startPlayback()
            
        } catch (error) {
            console.error("Error loading the song file:", error);
        }
    },
    get getCurrentnote() {
        return this.leveldata.notes[this._internalIndex]
    },
    advanceNote() {
        this._internalIndex++
    }
}