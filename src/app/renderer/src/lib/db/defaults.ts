import { IntRange } from "@/utils/types";
import { LibraryEntry } from ".";

export const defaultLibraryEntry: LibraryEntry = {
    type: "anime",
    favorite: false,
    status: "not_started",
    score: 0 as IntRange<1, 100>,
    episodeProgress: 0,
    chapterProgress: 0,
    volumeProgress: 0,
    restarts: 0,
    startDate: null,
    finishDate: null,
    notes: "",
    mapping: "myanimelist:anime:1"
}