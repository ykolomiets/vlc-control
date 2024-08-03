import chalk from 'chalk';
import { program } from "commander";
import { select } from "@inquirer/prompts";
import { path as ffprobePath } from "@ffprobe-installer/ffprobe";
import { spawn, spawnSync } from "node:child_process";
import { resolve as resolvePath } from "node:path";
import arrayWithout from "lodash.without";

const error = chalk.bold.red;
const info = chalk.yellow;
const success = chalk.bold.green;

const HTTP_PASSWORD = "home";

program
	.name("vlc-control")
	.argument("<filename>", "file to play")
	.action(run);

program.parse();

async function run(filename, options, command) {
	const audiotracks = getAudiotracks(filename);
	const mainAudiotrack = await selectAudiotrack("Select a main audiotrack", audiotracks);
	const auxAudiotrack = await selectAudiotrack("Select an additional audiotrack", arrayWithout(audiotracks, mainAudiotrack));

	const mainVlc = startVlc(filename, mainAudiotrack, 9090, HTTP_PASSWORD);
	const auxVlc = startVlc(filename, auxAudiotrack, 9091, HTTP_PASSWORD);

	process.on("exit", () => {
		mainVlc.kill("SIGINT");
		auxVlc.kill("SIGINT");
	});
}

function startVlc(filename, audiotrack, port, password) {
	const vlcProcess = spawn(
		"vlc",
		[
			filename,
			"--start-paused",
			`--audio-track-id=${audiotrack.idx}`,
			"--extraintf=http",
			`--http-port=${port}`,
			`--http-password=${password}`,
		]
	);

	vlcProcess.on("exit", (code) => {
		console.log(info(`VLC exited with code ${code}`));
		process.exit(0);
	});

	vlcProcess.on("error", (err) => {
		console.log(error(`VLC errored with ${err}`));
		process.exit(1);
	});

	const baseApiUrl = `http://127.0.0.1:${port}/requests/status.json`;
	const apiCredentials = Buffer.from(`:${password}`).toString("base64");
	const makeRequest = async (command) => {
		const res = await fetch(`${baseApiUrl}${command ? `?command=${command}` : ""}`, {
			headers: {
				Authorization: `Basic ${apiCredentials}`,
			},
		});
		const status = await res.json();
		return status;
	}

	return {
		kill: (signal) => vlcProcess.kill(signal),
		getStatus: () => makeRequest(),
		togglePause: () => makeRequest("pl_pause"),
	};
}

function getAudiotracks(filename) {
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
		console.log(error(`Failed to get audio tracks in ${filename}`));
		console.log(error(`ffprobe error: ${ffprobe.stderr}`));
		process.exit(1);
	}

	const { streams } = JSON.parse(ffprobe.stdout);
	const audiotracks = streams.map(s => ({
		idx: s.index,
		language: s.tags.language,
		title: s.tags.title,
	}));

	return audiotracks;
}

async function selectAudiotrack(prompt, audiotracks) {
	const buildName = (t) => {
		const parts = [`[${t.idx}]`];
		if (t.title) {
			parts.push(t.title);
		}
		if (t.language) {
			parts.push(`(${t.language})`);
		}
		return parts.join(" ");
	};

	const answer = await select({
		message: prompt,
		choices: audiotracks.map(t => ({
			value: t,
			name: buildName(t)
		})),
	});

	return answer;
}
