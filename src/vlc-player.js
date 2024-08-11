import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const generateId = (() => {
  let lastUsedId = 0;
  return () => ++lastUsedId;
})();

export function buildStartVlcPlayer({
  vlcBin,
  filename,
  httpInterfacePorts,
  httpInterfacePassword,
}) {
  const availablePorts = [...httpInterfacePorts];

  return async function startVlcPlayer({ noVideo, closeOrErrorCallback }) {
    const playerId = generateId();

    const port = availablePorts.pop();
    if (!port) {
      throw new Error("No available ports left");
    }

    const vlcOptions = [
      "--start-paused",
      "--extraintf=http",
      `--http-port=${port}`,
      `--http-password=${httpInterfacePassword}`,
    ];
    if (noVideo) {
      vlcOptions.push("--no-video");
    }

    const vlcProcess = spawn(vlcBin, [filename, ...vlcOptions]);

    let state = {};
    const executeIfNotClosed =
      (fn) =>
      (...args) => {
        if (state.isClosed) {
          console.warn(
            `VLC player #${playerId} is closed, executing any command is not possible`,
          );
          return;
        }
        return fn(...args);
      };

    const onExitOrError = () => {
      availablePorts.push(port);
      state = { isClosed: true };
      closeOrErrorCallback?.();
    };

    vlcProcess.on("exit", (code) => {
      console.log(`VLC player #${playerId}" exited with code ${code}`);
      onExitOrError();
    });

    vlcProcess.on("error", (err) => {
      console.error(`VLC player #${playerId}" errored with ${err}`);
      onExitOrError();
    });

    const baseApiUrl = `http://127.0.0.1:${port}/requests/status.json`;
    const apiCredentials = Buffer.from(`:${httpInterfacePassword}`).toString(
      "base64",
    );
    const makeRequest = async (command) => {
      const res = await fetch(
        `${baseApiUrl}${command ? `?command=${command}` : ""}`,
        {
          headers: {
            Authorization: `Basic ${apiCredentials}`,
          },
        },
      );
      const data = await res.json();
      state = {
        state: data.state,
        time: data.time,
        length: data.length,
        volume: data.volume,
        fullscreen: !!data.fullscreen,
        audiotracks: data.audiotracks,
        subtitletracks: data.subtitletracks,
        audiodevices: data.aoutdevices,
      };
    };

    const close = executeIfNotClosed(() => vlcProcess.kill("SIGTERM"));
    const refreshState = executeIfNotClosed(() => makeRequest());
    const togglePause = executeIfNotClosed(() => makeRequest("pl_pause"));
    const pause = executeIfNotClosed(async () => {
      await refreshState();
      if (state.state === "playing") {
        await togglePause();
      }
    });
    const seekTo = executeIfNotClosed((value) =>
      makeRequest(`seek&val=${value}`),
    );
    const toggleFullscreen = executeIfNotClosed(() =>
      makeRequest("fullscreen"),
    );
    const setVolume = executeIfNotClosed(async (value) => {
      await makeRequest(`volume&val=${value}`);
      // VLC may return previous volume value even if sucessfully updated it,
      // so we have to manually update state here
      state.volume = value;
    });
    const setAudiotrack = executeIfNotClosed((value) =>
      makeRequest(`audio_track&val=${value}`),
    );
    const setAudiodevice = executeIfNotClosed((value) =>
      makeRequest(`set_aout_device&val=${value}`),
    );
    const setSubtitleTrack = executeIfNotClosed((value) =>
      makeRequest(`subtitle_track&val=${value}`),
    );

    const player = {
      id: playerId,
      refreshState,
      getState: () => state,
      actions: {
        togglePause,
        pause,
        toggleFullscreen,
        seekTo,
        setVolume,
        setAudiotrack,
        setAudiodevice,
        setSubtitleTrack,
        close,
      },
    };

    return new Promise(async (resolve, reject) => {
      let error;
      for (let i = 0; i < 10; i++) {
        await setTimeout(200);
        try {
          await refreshState();
          return resolve(player);
        } catch (err) {
          error = err;
        }
      }
      console.error(
        `Failed to connect to VLC player #${playerId} http interface`,
      );
      console.error(error);
      close();
      reject();
    });
  };
}
