window.player = {
  drmLock: false,
  states: {
    STOPPED: 0,
    PLAYING: 1,
    PAUSED: 2,
    FORWARD: 3,
    REWIND: 4,
  },
  values: {
    forward_rewind: 0,
  },
  timers: {
    forward_rewind: NaN,
    scrubHold: NaN,
  },
  scrub: {
    dir: 0,
    taps: 0,
    holding: false,
  },
  state: -1,
  plugin: NaN,
  video: NaN,
  duration: 0,
  levelId: -1,
  playhead: null,

  getVideo: function () {
    player.video = document.getElementById("videoplayer");
    if (!player.video) {
      var newVideo = document.createElement("video");
      newVideo.id = "videoplayer";
      newVideo.style.height = "100%";
      newVideo.style.width = "100%";

      $("#video-screen .content").prepend(newVideo);
      player.video = newVideo;
    }
    return player.video;
  },

  // Releases the dash player and its media-element listeners. Leaving the
  // element attached kept the previous stream's timeupdate and audio alive
  // across episode, audio, and subtitle changes.
  dropPlugin: function () {
    var plugin = player.plugin;
    player.plugin = NaN;
    if (!plugin || typeof plugin.destroy !== "function") {
      return;
    }
    try {
      plugin.destroy();
    } catch (error) {
      console.log(error);
    }
  },

  unlisten: function (el) {
    var listeners = player.listeners;
    if (!el || !listeners) {
      return;
    }
    el.removeEventListener("timeupdate", listeners.time);
    el.removeEventListener("ended", listeners.ended);
    el.removeEventListener("waiting", listeners.waiting);
    el.removeEventListener("playing", listeners.playing);
    el.removeEventListener("seeked", listeners.seeked);
  },

  deleteVideo: function () {
    var el = document.getElementById("videoplayer");
    player.video = NaN;
    if (!el) {
      return;
    }
    player.unlisten(el);
    el.pause();
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  },

  config: function (timeFunction, endFunction) {
    player.deleteVideo();
    var el = player.getVideo();
    player.listeners = {
      time: timeFunction,
      ended: endFunction,
      waiting: player.onbufferingstart,
      playing: player.onbufferingcomplete,
      seeked: video.onSeeked,
    };
    el.addEventListener("timeupdate", player.listeners.time);
    el.addEventListener("ended", player.listeners.ended);
    el.addEventListener("waiting", player.listeners.waiting);
    el.addEventListener("playing", player.listeners.playing);
    el.addEventListener("seeked", player.listeners.seeked);
  },

  getPlayed: function () {
    return player.getVideo().currentTime;
  },

  getDuration: function () {
    return player.getVideo().duration;
  },

  // esto debe ejecutarse despues de el video_v2
  deleteSession: function (callback) {
    session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");
        fetch(
          `${service.api.drm}/v1/token/${callback.data.id}/${callback.data.token}`,
          {
            method: "DELETE",
            headers: headers,
          }
        )
          .then((response) => {
            return true;
          })
          .then((json) => {
            player.drmLock = false;
            callback.success && callback.success();
          })
          .catch((error) => callback.error && callback.error(error));
      },
    });
  },

  play: function (drm, url, playhead, noplay) {
    var generation = (player.generation || 0) + 1;
    player.generation = generation;
    if (!document.getElementById("video-screen")) {
      return;
    }
    player.resetScrub();
    player.dropPlugin();
    player.config(video.setPlayingTime, video.end);
    session.refresh({
      success: function (storage) {
        if (
          generation !== player.generation ||
          !document.getElementById("video-screen")
        ) {
          return;
        }
        player.plugin = dashjs.MediaPlayer().create();
        player.plugin.extend(
          "RequestModifier",
          () => {
            return {
              modifyRequestHeader: (xhr) => {
                xhr.setRequestHeader(
                  "Authorization",
                  "Bearer " + storage.access_token
                );
                return xhr;
              },
            };
          },
          true
        );

        if (session.storage.quality !== "auto") {
          player.plugin.updateSettings({
            streaming: {
              abr: { autoSwitchBitrate: { video: false } },
            },
          });
        }

        player.plugin.initialize(player.getVideo(), url, true);

        var drmConfig = {
          "com.widevine.alpha": {
            priority: 1,
            serverURL:
              "https://cr-license-proxy.prd.crunchyrollsvc.com/v1/license/widevine",
            httpRequestHeaders: {
              "X-Cr-Content-Id": drm.id,
              "X-Cr-Video-Token": drm.token,
            },
            serverCertificate:
              "CrsCCAMSEKDc0WAwLAQT1SB2ogyBJEwYv4Tx7gUijgIwggEKAoIBAQC8Xc/GTRwZDtlnBThq8V382D1oJAM0F/YgCQtNDLz7vTWJ+QskNGi5Dd2qzO4s48Cnx5BLvL4H0xCRSw2Ed6ekHSdrRUwyoYOE+M/t1oIbccwlTQ7o+BpV1X6TB7fxFyx1jsBtRsBWphU65w121zqmSiwzZzJ4xsXVQCJpQnNI61gzHO42XZOMuxytMm0F6puNHTTqhyY3Z290YqvSDdOB+UY5QJuXJgjhvOUD9+oaLlvT+vwmV2/NJWxKqHBKdL9JqvOnNiQUF0hDI7Wf8Wb63RYSXKE27Ky31hKgx1wuq7TTWkA+kHnJTUrTEfQxfPR4dJTquE+IDLAi5yeVVxzbAgMBAAE6DGNhc3RsYWJzLmNvbUABEoADMmGXpXg/0qxUuwokpsqVIHZrJfu62ar+BF8UVUKdK5oYQoiTZd9OzK3kr29kqGGk3lSgM0/p499p/FUL8oHHzgsJ7Hajdsyzn0Vs3+VysAgaJAkXZ+k+N6Ka0WBiZlCtcunVJDiHQbz1sF9GvcePUUi2fM/h7hyskG5ZLAyJMzTvgnV3D8/I5Y6mCFBPb/+/Ri+9bEvquPF3Ff9ip3yEHu9mcQeEYCeGe9zR/27eI5MATX39gYtCnn7dDXVxo4/rCYK0A4VemC3HRai2X3pSGcsKY7+6we7h4IycjqtuGtYg8AbaigovcoURAZcr1d/G0rpREjLdVLG0Gjqk63Gx688W5gh3TKemsK3R1jV0dOfj3e6uV/kTpsNRL9KsD0v7ysBQVdUXEbJotcFz71tI5qc3jwr6GjYIPA3VzusD17PN6AGQniMwxJV12z/EgnUopcFB13osydpD2AaDsgWo5RWJcNf+fzCgtUQx/0Au9+xVm5LQBdv8Ja4f2oiHN3dw",
            audioRobustness: "SW_SECURE_CRYPTO",
            videoRobustness: "SW_SECURE_CRYPTO",
            sessionType: "temporary",
          },
        };

        player.plugin.setProtectionData(drmConfig);

        player.plugin.registerLicenseRequestFilter(function (request) {
          request.headers["Content-Type"] = "application/octet-stream";
          request.headers["Authorization"] = "Bearer " + storage.access_token;
        });

        player.plugin.registerLicenseResponseFilter(function (response) {
          var responseDataUint8Array = new Uint8Array(response.data);
          var decodedString = new TextDecoder("utf-8").decode(
            responseDataUint8Array
          );
          var licenseObject = JSON.parse(decodedString);
          var binaryLicenseString = atob(licenseObject.license);
          var binaryLicenseUint8Array = new Uint8Array(
            binaryLicenseString.length
          );
          for (var i = 0; i < binaryLicenseString.length; i++) {
            binaryLicenseUint8Array[i] = binaryLicenseString.charCodeAt(i);
          }
          response.data = binaryLicenseUint8Array.buffer;
          player.drmLock = true;
        });

        player.noplay = noplay;

        // Seconds. Prefer the value video corrected once credits loaded;
        // the argument was captured before that marker arrived.
        var resume = playhead;
        if (
          video &&
          typeof video.resumeApplied === "number" &&
          isFinite(video.resumeApplied)
        ) {
          resume = video.resumeApplied;
        }
        player.playhead = null;
        if (isFinite(resume) && resume > 0) {
          player.playhead = resume;
        }
      },
    });
  },

  pause: function () {
    player.getVideo().pause();
    player.state = player.states.PAUSED;
  },

  resume: function () {
    player.getVideo().play();
    video.hideBTN();
    player.state = player.states.PLAYING;
    if (!video.userPaused) {
      return;
    }
    video.userPaused = false;
    var osd = document.getElementById("osd");
    if (
      osd &&
      osd.style.opacity === "1" &&
      !video.settings.open &&
      !video.speed.state
    ) {
      video.showOSD();
    }
  },

  playPause: function () {
    if (player.getVideo().paused) {
      player.resume();
    } else {
      player.pause();
    }
  },

  rewind: function (callback) {
    video.showBTN("rewind");
    player.seekStep(-1, callback);
  },

  forward: function (callback) {
    video.showBTN("forward");
    player.seekStep(1, callback);
  },

  // One or two taps move 10 seconds and then play. A third tap in the same
  // direction, before that settles, keeps stepping until pause or either end.
  seekStep: function (dir, callback) {
    if (player.scrub.holding && player.scrub.dir === dir) {
      return;
    }
    if (player.scrub.dir && player.scrub.dir !== dir) {
      player.clearScrubTimers();
      player.values.forward_rewind = 0;
      player.scrub.taps = 0;
      player.scrub.holding = false;
      player.scrub.dir = 0;
      if (video.setScrubHold) {
        video.setScrubHold(0);
      }
    }
    player.pause();
    clearTimeout(player.timers.forward_rewind);
    var continuing = player.scrub.dir === dir;
    player.scrub.dir = dir;
    player.scrub.taps = continuing ? player.scrub.taps + 1 : 1;
    player.values.forward_rewind += dir * 10;
    player.state = dir > 0 ? player.states.FORWARD : player.states.REWIND;
    callback(player.values.forward_rewind);
    if (player.scrub.taps >= 3) {
      player.beginScrubHold(callback);
      return;
    }
    player.timers.forward_rewind = setTimeout(function () {
      player.finishScrub(true);
    }, 500);
  },

  clampSeek: function (target) {
    if (!isFinite(target) || target < 0) {
      return 0;
    }
    var duration = player.getDuration();
    if (!isFinite(duration) || duration <= 0) {
      return target;
    }
    var limit = duration - duration * 0.02;
    if (target > limit) {
      return limit;
    }
    return target;
  },

  applyScrubOffset: function () {
    var pending = player.values.forward_rewind;
    player.values.forward_rewind = 0;
    if (!pending || !document.getElementById("videoplayer")) {
      return null;
    }
    var target = player.clampSeek(player.getPlayed() + pending);
    player.getVideo().currentTime = target;
    return target;
  },

  clearScrubTimers: function () {
    clearTimeout(player.timers.forward_rewind);
    clearTimeout(player.timers.scrubHold);
    player.timers.forward_rewind = NaN;
    player.timers.scrubHold = NaN;
  },

  resetScrub: function () {
    player.clearScrubTimers();
    player.values.forward_rewind = 0;
    player.scrub.dir = 0;
    player.scrub.taps = 0;
    player.scrub.holding = false;
    if (video.setScrubHold) {
      video.setScrubHold(0);
    }
  },

  beginScrubHold: function (callback) {
    player.clearScrubTimers();
    player.scrub.holding = true;
    player.applyScrubOffset();
    callback(0);
    if (video.setScrubHold) {
      video.setScrubHold(player.scrub.dir);
    }
    if (video.showOSD) {
      video.showOSD();
    }
    var step = function () {
      if (!player.scrub.holding || !document.getElementById("videoplayer")) {
        player.scrub.holding = false;
        return;
      }
      var played = player.getPlayed();
      var next = played + player.scrub.dir * 10;
      var clamped = player.clampSeek(next);
      var hitEnd = clamped !== next;
      player.getVideo().currentTime = clamped;
      player.values.forward_rewind = 0;
      callback(0);
      if (video.showOSD) {
        video.showOSD();
      }
      if (hitEnd) {
        player.finishScrub(true);
        return;
      }
      player.timers.scrubHold = setTimeout(step, 320);
    };
    player.timers.scrubHold = setTimeout(step, 320);
  },

  finishScrub: function (andPlay) {
    player.clearScrubTimers();
    player.applyScrubOffset();
    player.scrub.dir = 0;
    player.scrub.taps = 0;
    player.scrub.holding = false;
    if (video.setScrubHold) {
      video.setScrubHold(0);
    }
    if (andPlay && document.getElementById("videoplayer")) {
      player.resume();
    }
  },

  forwardTo: function (seconds) {
    player.getVideo().currentTime = seconds;
  },

  getQuality: function () {
    var qualities = player.plugin.getBitrateInfoListFor("video");
    var id = Object.keys(qualities).find(
      (key) => qualities[key].height === +session.storage.quality
    );
    return id !== undefined ? id : -1;
  },

  stop: function () {
    player.resetScrub();
    // Invalidates an in-flight play() so a late license callback cannot
    // start a stream after the screen is gone. State stays STOPPED until
    // the playing event, so a second episode could otherwise be left running.
    player.generation = (player.generation || 0) + 1;
    var el = document.getElementById("videoplayer");
    if (el) {
      el.pause();
    }
    player.dropPlugin();
    player.video = NaN;
    if (player.state != player.states.STOPPED) {
      player.STOP_CALLBACK && player.STOP_CALLBACK();
      player.state = player.states.STOPPED;
    }
  },

  speed: function (rate) {
    player.getVideo().playbackRate = rate;
  },

  destroy: function () {
    player.stop();
  },

  onbufferingstart: function () {
    video.showBTN("loading");
  },

  onbufferingcomplete: function () {
    if (!player.plugin || !document.getElementById("videoplayer")) {
      return;
    }
    if (session.storage.quality !== "auto") {
      player.plugin.setQualityFor("video", player.getQuality());
    }

    if (player.playhead) {
      player.getVideo().currentTime = player.playhead;
      player.playhead = null;
    }

    if (player.noplay) {
      player.noplay = null;
      player.pause();
    } else {
      player.getVideo().play();
      player.state = player.states.PLAYING;
    }

    // A new media element starts at 1x. Keep the speed chosen in this session.
    if (video.speed && video.speed.active) {
      player.getVideo().playbackRate = video.speed.active;
    }

    video.hideBTN();
  },

  oncurrentplaytime: function (currentTime) {
    video.setPlayingTime(currentTime);
  },

  onstreamcompleted: function () {
    console.log("onstreamcompleted");
    app.stop();
  },

  onevent: function (eventType, eventData) {
    console.log("onevent " + eventType + " - " + eventData);
  },

  onerror: function (eventType) {
    console.log("onerror " + eventType);
  },

  ondrmevent: function (drmEvent, drmData) {
    console.log("ondrmevent " + drmEvent + " - " + drmData);
  },

  onsubtitlechange: function (duration, text, type, attriCount, attributes) {
    console.log("onsubtitlechange");
  },
};
