#!/usr/bin/env node

import * as commander from "commander";
import { parsePortList } from "./cli/parse-options.js";
import { buildStartVlcPlayer } from "./vlc-player.js";
import { buildVlcPlayersControl } from "./vlc-players-control.js";
import { buildAndStartWebInterface } from "./web/index.js";

commander.program
  .name("vlc-control")
  .argument("<filename>", "file to play")
  .option("--vlc-bin <path-to-vlc>", "path to VLC", "vlc")
  .option(
    "--vlc-ports <ports>",
    "comma-separated list of ports to be used for VLC HTTP interface",
    parsePortList,
    [9000, 9001, 9002],
  )
  .option(
    "--vlc-password <password>",
    "password to VLC HTTP interface",
    "insecure_password",
  )
  .addOption(
    new commander.Option("--interface <intf>").choices(["web"]).default("web"),
  )
  .option("--web-port <number>", "port web server should be listening on", 3000)
  .action(main)
  .parse();

async function main(filename, options) {
  const startVlcPlayer = buildStartVlcPlayer({
    vlcBin: options.vlcBin,
    filename,
    httpInterfacePorts: options.vlcPorts,
    httpInterfacePassword: options.vlcPassword,
  });

  const control = buildVlcPlayersControl({ startVlcPlayer, maxPlayers: options.vlcPorts.length });
  if (options.interface === "web") {
    buildAndStartWebInterface({ port: options.webPort, control });
  }
}
