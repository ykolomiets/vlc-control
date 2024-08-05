import { path as ffprobePath } from "@ffprobe-installer/ffprobe";
import { spawnSync } from "node:child_process";

export function getAudiotracks(filename) {
	const ffprobe = spawnSync(
		ffprobePath, 
		[
			filename,
			"-show_entries", "stream=index,codec_type,codec_name:stream_tags=language,title",
			"-select_streams", "a",
			"-v", "error",
			"-of", "json"
		],
		{
			encoding: "utf-8",
			timeout: 1000,
		}
	);

	if (ffprobe.status !== 0) {
		console.error(`ffprobe error: ${ffprobe.stderr}`);
		throw new Error(`Failed to get list of audiotracks in ${filename}`);
	}

	const { streams } = JSON.parse(ffprobe.stdout);
	const audiotracks = streams.map(s => ({
		idx: s.index,
		language: s.tags.language,
		title: s.tags.title,
	}));

	return audiotracks;
}
