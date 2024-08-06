#!/usr/bin/env node

import * as commander from "commander";
import arrayWithout from "lodash.without";
import express from "express";
import { ips } from "./ips.js";
import { getAudiotracks } from "./get-audiotracks.js";
import { parsePortList } from "./cli/parse-options.js";
import { selectMainAudiotrack, selectSecondaryAudiotracks } from "./cli/select-audiotrack.js";
import { startVlcPlayer } from "./vlc-player.js";
import { buildVlcPlayersControl } from "./vlc-players-control.js";

commander.program
	.name("vlc-control")
	.argument("<filename>", "file to play")
	.option("--port <number>", "HTTP server port", 3000)
	.option("--vlc-bin <path-to-vlc>", "path to VLC", "vlc")
	.option(
		"--vlc-ports <ports>",
		"comma-separated list of ports to be used for VLC HTTP interface",
		parsePortList,
		[9000, 9001, 9002, 9003, 9004],
	)
	.option(
		"--vlc-password <password>",
		"password to VLC HTTP interface",
		"insecure_password"
	)
	.addOption(new commander.Option("--interface <intf>").choices(["web"]).default("web"))
	.action(main)
	.parse();

async function main(filename, options) {
	const audiotracks = getAudiotracks(filename);
	const mainAudiotrack = await selectMainAudiotrack(audiotracks);
	const secondaryAudiotracks = await selectSecondaryAudiotracks(arrayWithout(audiotracks, mainAudiotrack));

	if (secondaryAudiotracks.length > options.vlcPorts.length - 1) {
		console.error("Total number of required VLC players is more than specified VLC ports");
		process.exit(1);
	}

	const mainVlcPlayer = startVlcPlayer({
		vlcBin: options.vlcBin,
		playerName: `MAIN (${mainAudiotrack.title})`,
		filename,
		audiotrack: mainAudiotrack,
		noVideo: false,
		httpInterfacePort: options.vlcPorts[0],
		httpInterfacePassword: options.vlcPassword,
		closeOrErrorCallback: () => {
			process.exit(1);
		}
	});

	const secondaryVlcPlayers = secondaryAudiotracks.map(
		(audiotrack, idx) => startVlcPlayer({
			vlcBin: options.vlcBin,
			playerName: `SECONDARY (${audiotrack.title})`,
			filename,
			audiotrack,
			noVideo: false,
			httpInterfacePort: options.vlcPorts[idx + 1],
			httpInterfacePassword: options.vlcPassword,
		})
	);

	const control = buildVlcPlayersControl(mainVlcPlayer, secondaryVlcPlayers);

	const app = express();

	app.set('view engine', 'pug');
	app.set('views', './src/web/views');
//	app.use(express.static('public'));

	app.get('/', (req, res) => {
		res.render('index', { title: 'Hey', message: 'Hello there!' });
	});

	app.use((err, req, res, next) => {
		console.error(err)
		res.status(500).send('Something broke!')
	})

	app.get("/status", async (req, res) => {
		const status = await control.getStatus();
		return res.status(200).json(status);
	});

	app.post("/toggle-pause", async (req, res) => {
		await control.togglePause();
		return res.sendStatus(200);
	});

	app.post("/sync", async (req, res) => {
		await control.synchronize();
		return res.sendStatus(200);
	});

	app.post("/fullscreen", async (req, res) => {
		await control.toggleFullscreen();
		return res.sendStatus(200);
	});

	app.post("/volume/:playerId/:value", async (req, res) => {
		await control.setVolume(req.params.playerId, req.params.value);
		return res.sendStatus(200);
	});

	const httpServer = app.listen(options.port, "0.0.0.0", () => {
		console.log("Open one of the following URLs:");
		for (const ip of ips) {
			console.log(`\thttp://${ip}:${options.port}`);
		}
	});

	process.on("exit", () => {
		httpServer.close();
		control.closeAll();
	});
}
