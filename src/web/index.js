import express from "express";
import path from "node:path";
import { ips } from "./ips.js";

// TODO
// 5. additional playback controls (seek to)

export function buildAndStartWebInterface({ port, control }) {
  const app = express();

  app.set("view engine", "pug");
  app.set("views", path.join(import.meta.dirname, "./views"));

  app.use(
    "/static",
    express.static(path.join(import.meta.dirname, "./assets")),
  );
  app.use(express.urlencoded({ extended: true }));

  app.get("/", async (req, res) => {
    await control.refreshState();
    const state = control.getState();
    res.render("index", state);
  });

  app.get("/control-panel", async (req, res) => {
    await control.refreshState();
    const state = control.getState();
    res.render("includes/control-panel", state);
  });

  app.post("/main-player", async (req, res) => {
    await control.startMainPlayer();
    const state = control.getState();
    res.render("includes/control-panel", state);
  });

  app.post("/secondary-player", async (req, res) => {
    await control.addSecondaryPlayer();
    const state = control.getState();
    res.render("includes/control-panel", state);
  });

  app.post("/synchronize-players", async (req, res) => {
    await control.synchronizePlayers();
    const state = control.getState();
    res.render("includes/control-panel", state);
  });

  app.post("/toggle-pause", async (req, res) => {
    await control.togglePause();
    const state = control.getState();
    res.render("includes/control-panel", state);
  });

  app.post("/toggle-fullscreen", async (req, res) => {
    await control.toggleFullscreen();
    const state = control.getState();
    res.render("includes/control-panel", state);
  });

  app.patch("/players/:playerId", async (req, res) => {
    const playerId = parseInt(req.params.playerId);

    if (req.body.audiotrack) {
      await control.setAudiotrack(playerId, req.body.audiotrack);
    }
    if (req.body.audiodevice) {
      await control.setAudiodevice(playerId, req.body.audiodevice);
    }
    if (req.body.volume) {
      await control.setVolume(playerId, parseInt(req.body.volume));
    }
    if (req.body.subtitletrack) {
      await control.setSubtitleTrack(playerId, req.body.subtitletrack);
    }

    const state = control.getState();
    res.render("includes/control-panel", state);
  });

  app.delete("/players/:playerId", async (req, res) => {
    const playerId = parseInt(req.params.playerId);
    await control.closePlayer(playerId);
    const state = control.getState();
    res.render("includes/control-panel", state);
  });

  const httpServer = app.listen(port, "0.0.0.0", () => {
    console.log("Open one of the following URLs:");
    for (const ip of ips) {
      console.log(`\thttp://${ip}:${port}`);
    }
  });

  process.on("exit", () => {
    httpServer.close();
  });
}
