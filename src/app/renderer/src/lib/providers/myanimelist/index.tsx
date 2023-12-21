import { BaseProvider, Config } from "@/lib/providers";
import { MediaType } from "../../types";
import { serializeURL } from "@/utils";
import {
    ExternalAccount,
    MediaGenre,
    LibraryEntry,
    Media,
    MediaStatus,
    UserData,
    db,
    MediaFormat,
    MediaRating,
} from "../../db";
import { fetch } from "@tauri-apps/api/http";
import { IntRange } from "@/utils/types";
import config from "./config";

function normalizeTime(timeString: string) {
    const parts = timeString.split(" ");

    let totalSeconds = 0;

    for (let i = 0; i < parts.length; i += 2) {
        const value = parseInt(parts[i]);
        const unit = parts[i + 1];

        switch (unit) {
            case "hr":
            case "hrs":
                totalSeconds += value * 3600;
                break;
            case "min":
            case "mins":
                totalSeconds += value * 60;
                break;
            case "sec":
            case "secs":
                totalSeconds += value;
                break;
            default:
                break;
        }
    }

    return totalSeconds;
}

function normalizeGenre(genre: string): MediaGenre | undefined {
    // TODO: Add missing genres to the enum and map them
    const map = {
        action: MediaGenre.Action,
        adventure: MediaGenre.Adventure,
        "boys love": MediaGenre.Yaoi,
        comedy: MediaGenre.Comedy,
        drama: MediaGenre.Drama,
        fantasy: MediaGenre.Fantasy,
        "girls love": MediaGenre.Yuri,
        horror: MediaGenre.Horror,
        mistery: MediaGenre.Mistery,
        romance: MediaGenre.Romance,
        "sci-fi": MediaGenre.SciFi,
        "slice of life": MediaGenre.SliceOfLife,
        supernatural: MediaGenre.Supernatural,
        suspense: MediaGenre.Suspense,
    };

    return map[genre.toLowerCase() as keyof typeof map];
}

function normalizeLibraryStatus(status: string) {
    switch (status) {
        case "reading":
        case "watching":
            return "in_progress";

        case "completed":
            return "completed";

        case "on_hold":
            return "paused";

        case "dropped":
            return "dropped";

        case "plan_to_read":
        case "plan_to_watch":
            return "planned";

        default:
            return "not_started";
    }
}

function normalizeStatus(status: string): MediaStatus | undefined {
    return {
        "not yet started": MediaStatus.NotStarted,
        "currently airing": MediaStatus.InProgress,
        "finished airing": MediaStatus.Finished,
    }[status.toLowerCase()];
}

function normalizeFormat(format: string): MediaFormat | undefined {
    return {
        "tv": MediaFormat.Tv,
        "movie": MediaFormat.Movie,
        "special": MediaFormat.Special,
        "ova": MediaFormat.Ova,
        "ona": MediaFormat.Ona,
        "music": MediaFormat.Music,
    }[format.toLowerCase()];
}

function normalizeRating(rating: string): MediaRating | undefined {
    return {
        "g": MediaRating.G,
        "pg": MediaRating.PG,
        "pg-13": MediaRating.PG13,
        "r": MediaRating.R,
        "r+": MediaRating.RPlus,
        "rx": MediaRating.Rx,
    }[rating.toLowerCase().split("-")[0]];
}

export class MyAnimeList extends BaseProvider {
    name: string = "MyAnimeList";
    config: Config = config;

    private clientID = "bd5f6c8d2ebafac1378531805137ada3";

    private animeToInteralValue(anime: any): Media {
        return {
            type: "anime",
            title: {
                romaji: anime.titles.find(
                    (value: { type: string; title: string }) =>
                        value.type === "Default"
                ),
                english: anime.titles.find(
                    (value: { type: string; title: string }) =>
                        value.type === "English"
                ),
                native: anime.titles.find(
                    (value: { type: string; title: string }) =>
                        value.type === "Japanese"
                ),
            },
            imageUrl: anime.images.webp.large_image_url,
            bannerUrl: null,
            episodes: anime.episodes,
            startDate: anime.airing.from ? new Date(anime.airing.from) : null,
            finishDate: anime.airing.to ? new Date(anime.airing.to) : null,
            genres: anime.genres
                .map((value: { name: string }) => normalizeGenre(value.name))
                .filter((genre: string | undefined) => !!genre),
            status: normalizeStatus(anime.status) || null,
            format: normalizeFormat(anime.type) || MediaFormat.Tv,
            duration: anime.duration
                ? normalizeTime(anime.duration)
                : null,
            rating: normalizeRating(anime.rating) || null,
            mapping: `myanimelist:anime:${anime.mal_id}`
        };
    }

    private async searchAnime(options: {
        [key: string]: any;
    }): Promise<[Media[], boolean]> {
        let url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(
            options.query
        )}`;

        if (options.sortBy != null) {
            url += `&order_by=${options.sortBy}&sort=asc`;
        }

        delete options.query;
        delete options.sortBy;

        url += `&${serializeURL(options)}`;

        const res = await fetch<any>(url);

        if (res.ok === false) {
            return [[], true];
        }

        let animes: Media[] = res.data.data.map((anime: any) =>
            this.mediaFromAnimeJSON(anime)
        );

        return [animes, false];
    }

    private async getAnime({
        id,
    }: {
        id: string;
    }): Promise<[Media | null, boolean]> {
        let url = `https://api.jikan.moe/v4/anime/${id}/full`;

        const res = await fetch<any>(url);

        if (res.ok === false) {
            return [null, true];
        }

        let anime = this.mediaFromAnimeJSON(res.data.data);

        return [anime, false];
    }

    private mediaFromMangaJSON(manga: any): Media {
        return new Media(
            "manga",
            manga.mal_id,
            manga.titles.find((title: { type: string; title: string }) => {
                return title.type === "Default";
            }).title,
            manga.images.webp.large_image_url,
            null,
            manga.type,
            manga.status,
            manga.genres.map((genre: any) => genre.name),
            manga.published.from ? new Date(manga.published.from) : null,
            manga.published.to ? new Date(manga.published.to) : null,
            null,
            manga.chapters,
            manga.volumes,
            null,
            false,
            [`myanimelist:manga:${manga.mal_id.toString()}`]
        );
    }

    private async searchManga(options: {
        [key: string]: any;
    }): Promise<[Media[], boolean]> {
        let url = `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(
            options.query
        )}`;

        if (options.sortBy != null) {
            url += `&order_by=${options.sortBy}&sort=asc`;
        }

        delete options.query;
        delete options.sortBy;

        url += `&${serializeURL(options)}`;

        const res = await fetch<any>(url);

        if (res.ok === false) {
            return [[], true];
        }

        let mangas: Media[] = res.data.data.map((manga: any) =>
            this.mediaFromMangaJSON(manga)
        );

        return [mangas, false];
    }

    private async getManga({
        id,
    }: {
        id: string;
    }): Promise<[Media | null, boolean]> {
        let url = `https://api.jikan.moe/v4/manga/${id}/full`;

        const res = await fetch<any>(url);

        if (res.ok === false) {
            return [null, true];
        }

        let manga = this.mediaFromMangaJSON(res.data.data);

        return [manga, false];
    }

    private async importAnimeList(
        account: ExternalAccount,
        override: boolean = false
    ) {
        let url = `https://api.myanimelist.net/v2/users/${encodeURIComponent(
            account.auth!.username!
        )}/animelist?limit=1000&fields=list_status{status,score,num_episodes_watched,is_rewatching,start_date,finish_date,priority,num_times_rewatched,rewatch_value,tags,comments},start_date,end_date,nsfw,genres,media_type,num_episodes,rating,average_episode_duration`;

        const res = await fetch<any>(url, {
            method: "GET",
            headers: {
                "X-Mal-Client-ID": this.clientID,
            },
        });

        if (res.ok === false) {
            return;
        }

        let newMediaCache: Media[] = [];
        let newLibraryEntries: LibraryEntry[] = [];

        for (const entry of res.data.data) {
            // Cannot use the mediaFromMangaJSON because that function is for Jikan
            newMediaCache.push({
                type: "anime",
                title: entry.node.title,
                imageUrl: entry.node.main_picture?.large,
                bannerUrl: null,
                episodes: entry.node.num_episodes,
                chapters: null,
                volumes: null,
                startDate: entry.node.start_date
                    ? new Date(entry.node.start_date)
                    : null,
                finishDate: entry.node.end_date
                    ? new Date(entry.node.end_date)
                    : null,
                genres: entry.node.genres.map((genre: any) => genre.name),
                duration: Math.round(entry.node.average_episode_duration / 60),
                isAdult: entry.node.rating
                    ? entry.node.rating[0] === "r"
                    : false,
                mapping: `myanimelist:anime:${entry.node.id.toString()}`,
            });

            newLibraryEntries.push({
                type: "anime",
                favorite: false,
                status: normalizeLibraryStatus(entry.list_status.status),
                score: (entry.list_status.score * 10) as IntRange<1, 100>,
                episodeProgress: entry.list_status.num_episodes_watched,
                restarts: entry.list_status.num_times_rewatched,
                startDate: entry.list_status.start_date
                    ? new Date(entry.list_status.start_date)
                    : null,
                finishDate: entry.list_status.finish_date
                    ? new Date(entry.list_status.finish_date)
                    : null,
                notes: entry.list_status.comments,
                mapping: `myanimelist:anime:${entry.node.id.toString()}`,
            });
        }

        await db.media.bulkPut(newMediaCache);

        if (override) {
            await db.library.bulkPut(newLibraryEntries);
        } else {
            try {
                await db.library.bulkAdd(newLibraryEntries);
            } catch (e) {
                null;
            }
        }
    }

    private async importMangaList(
        account: ExternalAccount,
        override: boolean = false
    ) {
        let url = `https://api.myanimelist.net/v2/users/${encodeURIComponent(
            account.auth!.username!
        )}/mangalist?limit=1000&fields=list_status{status,score,num_chapters_read,num_volumes_read,is_rereading,start_date,finish_date,priority,num_times_reread,reread_value,tags,comments},start_date,end_date,nsfw,genres,media_type,num_chapters,num_volumes`;

        const res = await fetch<any>(url, {
            method: "GET",
            headers: {
                "X-Mal-Client-ID": this.clientID,
            },
        });

        if (res.ok === false) {
            return;
        }

        let newMediaCache: Media[] = [];
        let newLibraryEntries: LibraryEntry[] = [];

        for (const entry of res.data.data) {
            // Cannot use the mediaFromMangaJSON because that function is for Jikan
            newMediaCache.push({
                type: "manga",
                title: entry.node.title,
                imageUrl: entry.node.main_picture?.large,
                bannerUrl: null,
                episodes: null,
                chapters: entry.node.num_chapters,
                volumes: entry.node.num_volumes,
                startDate: entry.node.start_date
                    ? new Date(entry.node.start_date)
                    : null,
                finishDate: entry.node.end_date
                    ? new Date(entry.node.end_date)
                    : null,
                genres: entry.node.genres.map((genre: any) => genre.name),
                duration: null,
                isAdult: entry.node.rating
                    ? entry.node.nsfw === "black"
                    : false,
                mapping: `myanimelist:manga:${entry.node.id.toString()}`,
            });

            newLibraryEntries.push({
                type: "manga",
                favorite: false,
                status: normalizeLibraryStatus(entry.list_status.status),
                score: (entry.list_status.score * 10) as IntRange<1, 100>,
                chapterProgress: entry.list_status.num_chapters_read,
                volumeProgress: entry.list_status.num_volumes_read,
                restarts: entry.list_status.num_times_reread,
                startDate: entry.list_status.start_date
                    ? new Date(entry.list_status.start_date)
                    : null,
                finishDate: entry.list_status.finish_date
                    ? new Date(entry.list_status.finish_date)
                    : null,
                notes: entry.list_status.comments,
                mapping: `myanimelist:manga:${entry.node.id.toString()}`,
            });
        }

        await db.media.bulkPut(newMediaCache);

        if (override) {
            await db.library.bulkPut(newLibraryEntries);
        } else {
            try {
                // Will only add items that don't exist. If there is one or
                // more items that already exist, it will throw an error but
                // still add the rest of the items.
                await db.library.bulkAdd(newLibraryEntries);
            } catch (e) {
                console.log(e);
                null;
            }
        }
    }

    async search(
        type: MediaType,
        options: { [key: string]: any }
    ): Promise<[Media[], boolean]> {
        let result: [Media[], boolean];

        switch (type) {
            case "anime":
                result = await this.searchAnime(options);
                break;

            case "manga":
                result = await this.searchManga(options);
                break;

            default:
                result = [[], true];
        }

        return result;
    }

    async getMedia(
        type: MediaType,
        { id }: { id: string }
    ): Promise<[Media | null, boolean]> {
        switch (type) {
            case "anime":
                return await this.getAnime({ id });

            case "manga":
                return await this.getManga({ id });

            default:
                return [null, true];
        }
    }

    async importList(
        type: MediaType,
        account: ExternalAccount,
        override: boolean = false
    ) {
        switch (type) {
            case "anime":
                await this.importAnimeList(account, override);
                break;

            case "manga":
                await this.importMangaList(account, override);
                break;
        }
    }

    async getUser(account: ExternalAccount): Promise<UserData> {
        const url = `https://api.jikan.moe/v4/users/${encodeURIComponent(
            account.auth!.username!
        )}/full`;

        const res = await fetch<any>(url);

        if (res.ok === false) {
            throw Error("Failed to get user");
        }

        const data = res.data.data;
        console.log(data);

        return {
            id: data.mal_id.toString(),
            name: data.username,
            imageUrl: data.images.webp.image_url,
        };
    }
}
