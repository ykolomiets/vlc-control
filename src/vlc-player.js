import { spawn } from "node:child_process";

const generateId = (() => {
	let lastUsedId = 0;
	return () => ++lastUsedId;
})();

export function startVlcPlayer({
	vlcBin,
	playerName,
	filename,
	audiotrack,
	noVideo,
	httpInterfacePort,
	httpInterfacePassword,
	closeOrErrorCallback,
}) {
	const playerId = generateId();

	const vlcOptions = [
		"--start-paused",
		`--audio-track-id=${audiotrack.idx}`,
		"--extraintf=http",
		`--http-port=${httpInterfacePort}`,
		`--http-password=${httpInterfacePassword}`,
	];
	if (noVideo) {
		vlcOptions.push("--no-video");
	}

	const vlcProcess = spawn(vlcBin, [ filename, ...vlcOptions ]);

	let isClosed = false;
	const executeIfNotClosed = (fn) => (...args) => {
		if (isClosed) {
			console.warn(`VLC player "${playerName}" is closed, executing any command is not possible`);
			return ;
		}
		return fn(...args);
	};

	vlcProcess.on("exit", (code) => {
		console.log(`VLC player "${playerName}" exited with code ${code}`);
		isClosed = true;
		closeOrErrorCallback?.();
	});

	vlcProcess.on("error", (err) => {
		console.error(`VLC player "${playerName}" errored with ${err}`);
		isClosed = true;
		closeOrErrorCallback?.();
	});

	const baseApiUrl = `http://127.0.0.1:${httpInterfacePort}/requests/status.json`;
	const apiCredentials = Buffer.from(`:${httpInterfacePassword}`).toString("base64");
	const makeRequest = async (command) => {
		const res = await fetch(`${baseApiUrl}${command ? `?command=${command}` : ""}`, {
			headers: {
				Authorization: `Basic ${apiCredentials}`,
			},
		});
		const status = await res.json();
		return status;
	}

	const close = executeIfNotClosed(() => vlcProcess.kill("SIGTERM"));
	const getStatus = async () => {
		if (isClosed) {
			return { closed: true };
		}
		return makeRequest();
	};
	const togglePause = executeIfNotClosed(() => makeRequest("pl_pause"));
	const pause = executeIfNotClosed(
		async () => {
			const status = await getStatus();
			if (status.state === "playing") {
				await togglePause();
			}
		}
	);
	const seekTo = executeIfNotClosed((value) => makeRequest(`seek&val=${value}`));
	const toggleFullscreen = executeIfNotClosed(() => makeRequest("fullscreen"));
	const setVolume = executeIfNotClosed((value) => makeRequest(`volume&val=${value}`));

	return {
		id: playerId,
		name: playerName,
		close,
		getStatus,
		togglePause,
		pause,
		toggleFullscreen,
		seekTo,
		setVolume,
	};
}
