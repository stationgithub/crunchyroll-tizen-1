window.video = {
  id: "video-screen",
  previous: null,
  episode: null,
  token: null,
  speed: {
    options: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
    active: 1,
    state: false,
  },
  next: {
    shown: false,
    state: false,
    time: 60,
    episode: null,
    dismissed: false,
  },
  option: false,
  skipFocus: false,
  userPaused: false,
  options: [
    {
      icon: "previous",
      action: "restartOrPrevious",
    },
    {
      icon: "next",
      action: "nextEpisode",
      param: true,
    },
    {
      icon: "subtitles",
      action: "openLanguages",
    },
  ],
  playerIcons: {
    previous:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.75 6.6 10.4 12l9.35 5.4Z"/><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M5.65 5.75v12.5"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.25 6.6 13.6 12 4.25 17.4Z"/><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M18.35 5.75v12.5"/></svg>',
    speed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.72 16.63a7.25 7.25 0 1 1 12.56 0"/><path d="M12 13 14.52 9.4"/></svg>',
    subtitles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5.75" width="16" height="12.5" rx="1.75"/><path d="M7.25 10.15h3.15M13.4 10.15h3.35M7.25 13.7h2.2M11.2 13.7h5.55"/></svg>',
  },
  subtitles: [],
  subtitle: null,
  streamUrl: null,
  isDub: false,
  audios: [],
  audio: null,
  intro: null,
  credits: null,
  skipWindows: {},
  skipList: [],
  skipKind: null,
  lastTime: null,
  buffering: false,
  resumeSource: null,
  resumeApplied: null,
  resumeCreditsChecked: true,
  openedNearEnd: false,
  holdNextOnOpen: false,
  suppressOpenEnd: false,
  // Set only by playNext, for the ended / countdown / up-next handoff.
  handoffNext: false,
  openingFromNext: false,
  openTime: null,
  streams: [],
  timers: {
    history: {
      object: null,
      duration: 30000,
    },
    next: null,
    pulse: null,
    spinner: null,
    transport: null,
    still: null,
    resumeNote: null,
    osd: {
      object: null,
      duration: 4000,
    },
  },
  settings: {
    open: false,
    selected: false,
  },

  playerIcon: function (name) {
    return video.playerIcons[name] || "";
  },

  openLanguages: function () {
    video.leaveStill();
    video.hideOSD();
    video.settings.open = true;
    player.pause();
    $("#osd-icon").hide();
    $(".player-settings").hide();
    video.setAudios();
    video.setSubtitles();
    video.setSubtitleSizes();
    video.setSpeeds();
    $("#hide-dupes").toggleClass("on", !!video.hideDupes);
    $(".settings-slide").addClass("open");
    $(`#${video.id}`).addClass("panel-open");
    video.panel.focusColumn("subtitles");
  },

  closeLanguages: function () {
    video.settings.open = false;
    $(".settings-slide").removeClass("open");
    $(`#${video.id}`).removeClass("panel-open");
    $("#osd-icon").show();
    video.settings.selected = false;
    $("#setting-options").removeClass("selected");
    $(".player-settings").show();
    player.resume();
  },

  // Track panel: Audio / Subtitles / Text size / Speed. Left/Right moves
  // between columns. Audio, subtitles, and text size land on the current
  // choice. Speed always lands on 1. Up/Down moves within a column.
  panel: {
    column: "subtitles",

    columns: function () {
      return ["audios", "subtitles", "subtitle-sizes", "speeds"].filter(function (id) {
        return $(`#${id} .option`).length > 0;
      });
    },

    options: function (id) {
      id = id || video.panel.column;
      if (id === "subtitles") {
        return $("#subtitles .option, #hide-dupes");
      }
      return $(`#${id} .option`);
    },

    focusColumn: function (id) {
      var columns = video.panel.columns();
      if (columns.indexOf(id) < 0) {
        id = columns.indexOf("subtitles") >= 0 ? "subtitles" : columns[0];
      }
      video.panel.column = id;
      $("#languages-content .track-column").removeClass("focused");
      $(`#${id}-column`).addClass("focused");
      var options = video.panel.options(id);
      if (id === "speeds") {
        var start = 0;
        options.each(function (index) {
          if ($(this).find(".option-label").text() === "1") {
            start = index;
          }
        });
        video.panel.focus(start);
        return;
      }
      var active = options.index(options.filter(".active"));
      video.panel.focus(active >= 0 ? active : 0);
    },

    focus: function (index) {
      $("#languages-content .option").removeClass("selected");
      var options = video.panel.options();
      var target = options.eq(Math.max(0, Math.min(index, options.length - 1)));
      target.addClass("selected");
      video.panel.reveal(target[0]);
    },

    // Keeps the focused row inside the list viewport, above the bottom fade.
    reveal: function (item) {
      if (!item || !item.parentNode.parentNode.clientHeight) {
        return;
      }
      var list = item.parentNode;
      shelf.reveal(list, item, list.parentNode.clientHeight - video.panel.fade);
    },
    fade: 32,

    move: function (step) {
      var options = video.panel.options();
      var current = options.index(options.filter(".selected"));
      video.panel.focus(current + step);
    },

    switchColumn: function (step) {
      var columns = video.panel.columns();
      var index = columns.indexOf(video.panel.column) + step;
      if (index >= 0 && index < columns.length) {
        video.panel.focusColumn(columns[index]);
      }
    },

    select: function () {
      var options = video.panel.options();
      var selected = options.filter(".selected");
      var index = options.index(selected);
      if (video.panel.column === "subtitles" && selected.is("#hide-dupes")) {
        video.toggleHideDupes();
        return;
      }
      if (
        index < 0 ||
        selected.hasClass("active") ||
        selected.hasClass("unavailable")
      ) {
        return;
      }
      options.removeClass("active");
      selected.addClass("active");
      if (video.panel.column === "audios") {
        video.changeAudio(index);
      } else if (video.panel.column === "subtitles") {
        video.changeScript(index);
      } else if (video.panel.column === "speeds") {
        video.chooseSpeed(index);
      } else {
        subtitleOverlay.setPref("size", subtitleOverlay.prefChoices.size[index]);
      }
    },

    keyDown: function (event) {
      switch (event.keyCode) {
        case tvKey.KEY_UP:
          video.panel.move(-1);
          return true;
        case tvKey.KEY_DOWN:
          video.panel.move(1);
          return true;
        case tvKey.KEY_LEFT:
        case tvKey.KEY_PREVIOUS:
          video.panel.switchColumn(-1);
          return true;
        case tvKey.KEY_RIGHT:
        case tvKey.KEY_NEXT:
          video.panel.switchColumn(1);
          return true;
        case tvKey.KEY_ENTER:
        case tvKey.KEY_PANEL_ENTER:
          video.panel.select();
          return true;
      }
      return false;
    },

    // Re-renders keep focus on the same row while the panel is open.
    refresh: function (id, focused) {
      if (!video.settings.open || video.panel.column !== id) {
        return;
      }
      // A column can disappear while focus is still sitting in it.
      if (video.panel.options(id).length === 0) {
        video.panel.focusColumn("subtitles");
        return;
      }
      if (focused >= 0) {
        video.panel.focus(focused);
      } else {
        video.panel.focusColumn(id);
      }
    },
  },

  renderOptions: function (id, items) {
    var list = document.getElementById(id);
    if (!list) {
      return;
    }
    var focused = $(list).children(".option").index($(list).children(".selected"));
    list._offset = 0;
    list.style.transform = "";
    list.closest(".track-column").classList.toggle("empty", items.length === 0);
    list.innerHTML = items
      .map(
        (item) =>
          `<li class="option${item.active ? " active" : ""}${
            item.unavailable ? " unavailable" : ""
          }">` +
          `<span class="option-label">${item.label}</span>` +
          (item.description
            ? `<span class="option-description">${item.description}</span>`
            : "") +
          `</li>`
      )
      .join("");
    video.panel.refresh(id, focused);
  },

  episodeLabel: function (item) {
    var title = (item && item.episode) || "";
    var season = item && item.season_number != null ? item.season_number : 0;
    var number = item && item.episode_number != null ? item.episode_number : 0;
    var label = "S" + season + ": E" + number;
    if (title) {
      label += ' "' + title + '"';
    }
    return label;
  },

  getSettings: function () {
    return video.options
      .map(
        (element) =>
          `<span class="player-icon">${video.playerIcon(element.icon)}</span>`
      )
      .join("");
  },

  init: function (item) {
    var video_element = document.createElement("div");
    video_element.id = video.id;

    video.play(item);

    video_element.innerHTML = `
    <div class="content">
      <img id="background" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=">
      <video id="videoplayer" style="width:100%; height:100%;"></video>
      <div id="subtitle-overlay"></div>
        <div class="osd transport-focus" id="osd">
        <div class="player-settings">
          <div id="setting-options">
            ${video.getSettings()}
          </div>
        </div>
        <div class="details">
          <div id="title">${item.serie}</div>
          <div id="subtitle">
            ${video.episodeLabel(item)}
          </div>
        </div>
        <div class="progress">
          <div id="time">00:00:00</div>
          <div class="bar">
            <div id="played">
              <div class="preview">
                <img id="preview">
              </div>
              <div class="knob"><img class="scrub-flame" src="server/img/scrub-flame.gif" alt=""><span id="knob-time">00:00:00</span></div>
            </div>
          </div>
          <div id="total">00:00:00</div>
        </div>
        <div class="osd-center">
          <span class="osd-skip back">
            <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" d="M31 13.5A13.5 13.5 0 1 0 37.5 26"/><path fill="currentColor" d="M29.2 8.2 38.6 14l-9.6 2.2z"/></svg>
            <span>10</span>
          </span>
          <span class="osd-play">
            <svg class="glyph-pause" viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M16 12h5.5v24H16zM26.5 12H32v24h-5.5z"/></svg>
            <svg class="glyph-play" viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M18 12.5 36 24 18 35.5z"/></svg>
          </span>
          <span class="osd-skip forward">
            <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" d="M31 13.5A13.5 13.5 0 1 0 37.5 26"/><path fill="currentColor" d="M29.2 8.2 38.6 14l-9.6 2.2z"/></svg>
            <span>10</span>
          </span>
        </div>
      </div>
      <div id="osd-icon" class="icon-status">
        <div class="icon"></div>
        ${loading.lineMarkup("line-spin-osd")}
        <div id="osd-icon-data" class="percent"></div>
      </div>
      <div id="resume-note" class="resume-note" hidden>
        <span>Press</span>
        <span class="resume-note-icon">${video.playerIcon("previous")}</span>
        <span>to start from the beginning</span>
      </div>
      <div class="next-episode">
        <div class="next-episode-image">
          <img id="next-episode-image">
          <div id="next-episode-count"></div>
        </div>
      </div>

      <div id="skip-intro">
        <i class="fa-solid fa-forward"></i>
        <span class="skip-label">${translate.go("video.skip")}</span>
      </div>
      <div class="settings-slide">
        <div id="languages-content">
          <div class="track-column" id="audios-column">
            <div class="title">${translate.go("video.languages.audios")}</div>
            <div class="track-list"><ul id="audios"></ul></div>
          </div>
          <div class="track-column" id="subtitles-column">
            <div class="title">${translate.go("video.languages.subtitles")}</div>
            <div class="track-list">
              <ul id="subtitles"></ul>
              <div id="hide-dupes" class="option dupe-option">
                <div class="dupe-head">
                  <span class="option-label">${translate.go("video.languages.hide_dupes")}</span>
                  <span class="switch" aria-hidden="true"><span class="knob"></span></span>
                </div>
                <span class="option-description">${translate.go("video.languages.hide_dupes_description")}</span>
              </div>
            </div>
          </div>
          <div class="track-column" id="subtitle-sizes-column">
            <div class="title">${translate.go("video.languages.text_size")}</div>
            <div class="track-list"><ul id="subtitle-sizes"></ul></div>
          </div>
          <div class="track-column" id="speeds-column">
            <div class="title">${translate.go("video.languages.speed_title")}</div>
            <div class="track-list"><ul id="speeds"></ul></div>
          </div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(video_element);
    document.getElementById("skip-intro").addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      video.activateSkip();
    });

    $(`#${home.id}`).hide();
    video.previous = main.state;
    main.state = video.id;
  },

  destroy: function () {
    var screen = document.getElementById(video.id);
    if (!screen || video.leaving) {
      return;
    }
    video.leaving = true;
    if (document.getElementById(home.id)) {
      $(`#${home.id}`).show();
    }
    screen.classList.add("leaving");
    setTimeout(function () {
      video.finishDestroy();
    }, 440);
  },

  finishDestroy: function () {
    clearTimeout(video.timers.pulse);
    clearTimeout(video.timers.spinner);
    clearTimeout(video.timers.transport);
    clearTimeout(video.timers.still);
    clearTimeout(video.timers.resumeNote);
    video.timers.resumeNote = null;
    video.timers.spinner = null;
    video.timers.transport = null;
    video.timers.still = null;
    video.buffering = false;
    video.userPaused = false;
    video.leaving = false;
    video.playRequest = (video.playRequest || 0) + 1;
    video.settings.open = false;
    video.intro = null;
    video.credits = null;
    video.skipWindows = {};
    video.skipList = [];
    video.skipKind = null;
    video.hideOSD();
    player.stop();
    clearTimeout(video.timers.osd.object);
    video.clearNextTimer();
    video.lastTime = null;
    clearInterval(video.timers.history.object);
    main.state = video.previous;
    if (
      main.state === home.id &&
      window.home &&
      home.position === 0 &&
      home.armSlide &&
      document.getElementById(home.id)
    ) {
      home.armSlide();
    }
    document.body.removeChild(document.getElementById(video.id));
    $(`#${home.id}`).show();
    video.next.episode = null;
    video.next.status = false;
    video.next.shown = false;
    video.episode = null;
    video.data = null;
    video.streams = [];
    video.speed.state = false;
    video.speed.active = 1;
    subtitleOverlay.stop();
  },

  keyDown: function (event) {
    if (video.leaving) {
      return;
    }
    if (video.settings.open && video.panel.keyDown(event)) {
      return;
    }
    var osd = true;
    switch (event.keyCode) {
      case tvKey.KEY_STOP:
      case tvKey.IS_KEY_BACK(event.keyCode):
        if (video.settings.open) {
          osd = false;
          video.closeLanguages();
        } else {
          if (video.next.status) {
            video.next.dismissed = true;
            video.stopNext();
          } else if (video.speed.state) {
            video.hidePlaySpeed();
            video.showOSD();
          } else {
            osd = false;
            video.destroy();
          }
        }
        break;
      case tvKey.KEY_PLAY:
        !video.settings.open && video.togglePlay("resume");
        break;
      case tvKey.KEY_PAUSE:
        !video.settings.open && video.togglePlay("pause");
        break;
      case tvKey.KEY_PLAY_PAUSE:
        !video.settings.open && video.togglePlay("playPause");
        break;
      case tvKey.KEY_ENTER:
      case tvKey.KEY_PANEL_ENTER:
        if (video.skipFocus) {
          osd = false;
          video.activateSkip();
        } else if (video.option) {
          var selected = $("#setting-options .player-icon").index(
            $("#setting-options .player-icon.selected")
          );
          if (selected >= 0) {
            osd = !video[video.options[selected].action](
              video.options[selected].param
            );
          }
        } else if (
          video.next.status &&
          document.getElementById("osd").style.opacity != 1
        ) {
          video.clearNextTimer();
          video.playNext();
        } else if (document.getElementById("osd").style.opacity == 1) {
          video.togglePlay("playPause");
        }
        break;
      case tvKey.KEY_PREVIOUS:
      case tvKey.KEY_LEFT:
        if (video.option) {
          if (video.speed.state) {
            osd = false;
            video.setSpeed(-1);
          } else {
            var options = $("#setting-options .player-icon");
            var selected = options.index($("#setting-options .player-icon.selected"));
            options.removeClass("selected");
            options
              .eq(selected > 0 ? selected - 1 : selected)
              .addClass("selected");
          }
        } else {
          if (video.skipFocus) {
            video.releaseSkipFocus();
          }
          !video.settings.open && player.rewind(video.setPlayingTime);
        }
        break;
      case tvKey.KEY_RIGHT:
      case tvKey.KEY_NEXT:
        if (video.option) {
          if (video.speed.state) {
            osd = false;
            video.setSpeed(1);
          } else {
            var options = $("#setting-options .player-icon");
            var selected = options.index($("#setting-options .player-icon.selected"));
            options.removeClass("selected");
            options
              .eq(selected < video.options.length - 1 ? selected + 1 : selected)
              .addClass("selected");
          }
        } else {
          if (video.skipFocus) {
            video.releaseSkipFocus();
          }
          !video.settings.open && player.forward(video.setPlayingTime);
        }
        break;
      case tvKey.KEY_UP:
        if (
          document.getElementById("osd").style.opacity == 1 &&
          !video.option
        ) {
          if (!video.skipFocus && video.skipShown()) {
            video.focusSkip();
          } else {
            video.clearSkipFocus();
            $("#setting-options").children().first().addClass("selected");
            video.option = true;
          }
        }
        break;
      case tvKey.KEY_DOWN:
        if (video.speed.state) {
          video.hidePlaySpeed();
          video.showOSD();
        } else if (video.option && video.skipShown()) {
          video.focusSkip();
        } else {
          video.option = false;
          video.clearSkipFocus();
          $("#setting-options").children().removeClass("selected");
        }
        break;
    }
    !video.settings.open && !video.speed.state && osd && video.showOSD();
  },

  end: function () {
    if (video.suppressOpenEnd) {
      var time = video.playbackTime();
      var duration = player.getDuration();
      video.suppressOpenEnd = false;
      if (
        isFinite(duration) &&
        duration > 0 &&
        isFinite(time) &&
        time >= duration - 1.25
      ) {
        return;
      }
    }
    video.advanceOnReady = true;
    if (video.next.episode && video.next.episode.id) {
      video.playNext();
      return;
    }
    if (!video.next.shown) {
      video.nextEpisode(true);
    }
  },

  play: function (item, noplay) {
    var fromNext = !!video.handoffNext;
    video.handoffNext = false;
    var request = (video.playRequest || 0) + 1;
    video.playRequest = request;
    video.lastTime = null;
    video.next.dismissed = false;
    video.resumeSource = null;
    video.resumeApplied = null;
    video.resumeCreditsChecked = true;
    video.openedNearEnd = false;
    video.holdNextOnOpen = false;
    video.suppressOpenEnd = false;
    video.openTime = null;
    video.openingFromNext = fromNext;
    video.advanceOnReady = false;
    video.hideResumeNote();
    video.buffering = false;
    video.armedPrevious = false;
    video.sawStart = false;
    video.episode = item.id;
    if (item.serie) {
      video.seriesTitle = item.serie;
    }
    if (item.seriesId && item.id && session.storage) {
      if (!session.storage.lastPlayed) {
        session.storage.lastPlayed = {};
      }
      session.storage.lastPlayed[item.seriesId] = {
        id: item.id,
        season: item.season_number,
      };
      session.update();
    }
    video.option = false;
    video.userPaused = false;
    video.leaveStill();
    video.clearSkipFocus();
    var osd = document.getElementById("osd");
    if (osd && !video.speed.state) {
      osd.classList.add("transport-focus");
      $("#setting-options .player-icon").removeClass("selected");
    }
    service.video_v2({
      data: {
        id: item.id,
      },
      success: function (data) {
        if (request !== video.playRequest || !document.getElementById(video.id)) {
          player.deleteSession({
            data: {
              id: item.id,
              token: data.token,
            },
          });
          return;
        }
        video.token = data.token;
        video.stopNext();
        video.setSkipIntro(item.id);
        video.next.shown = false;
        try {
          video.audio = session.usableLanguage(data.audioLocale, "en-US");
          video.audios = [{ name: video.audio, id: item.id }];
          if (data.versions) {
            var mappedAudios = data.versions
              .map((element) => ({
                name: element.audio_locale,
                id: element.guid,
                original: element.original,
              }))
              .filter(function (element) {
                return session.usableLanguage(element.name, "");
              });
            if (mappedAudios.length) {
              video.audios = mappedAudios;
            }
          }

          var isDub = !video.isOriginalAudio(data, item.id);
          video.isDub = isDub;
          video.streamUrl = data.url;
          video.script = video.savedScript() || (isDub ? "dub" : "sub");
          video.hideDupes = !!session.storage.hideDupes;
          video.scripts = ["off", "sub", "dub"].map(function (name) {
            return Object.assign({ name: name }, video.scriptCopy(name, null));
          });

          subtitleOverlay
            .prepare({
              episodeId: item.id,
              playData: data,
              versions: video.audios,
            })
            .then(function (sources) {
              if (sources && video.episode === item.id) {
                video.applyOverlayAvailability(item.id, sources);
              }
            });
          subtitleOverlay.setTrack(video.script, video.hideDupes);

          var resumeAt = video.openingSeconds(item);
          video.resumeApplied = resumeAt;
          if (video.openedNearEnd) {
            video.showResumeNote();
          }
          player.play(
            { token: data.token, id: item.id },
            data.url,
            resumeAt,
            noplay
          );
          video.startHistory();
          video.setAudios();
          video.setSubtitles();
          video.setSubtitleSizes();
          video.setSpeeds();
          $("#hide-dupes").toggleClass("on", !!video.hideDupes);
        } catch (error) {
          console.log(error);
        }

        setTimeout(() => {
          player.deleteSession({
            data: {
              id: video.episode,
              token: video.token,
            },
          });
        }, 3000);
        video.showOSD();
      },
      error: function (error) {
        video.stopNext();
        video.next.shown = false;
        console.log(error);
      },
    });
  },

  isOriginalAudio: function (data, id) {
    var version = (data.versions || []).find((element) => element.guid === id);
    if (version && typeof version.original === "boolean") {
      return version.original;
    }
    return String(data.audioLocale || "").indexOf("ja") === 0;
  },

  setSkipIntro: function (id) {
    var request = video.playRequest;
    video.intro = null;
    video.credits = null;
    video.skipWindows = {};
    video.skipList = [];
    video.skipKind = null;
    $("#skip-intro").hide();
    service.intro({
      data: {
        id,
      },
      success: function (data) {
        if (request !== video.playRequest || !document.getElementById("skip-intro")) {
          return;
        }
        video.loadSkipWindows(data || {});
        video.correctOpeningResume();
        video.showSkip(video.playbackTime());
        video.syncNextCard(video.playbackTime(), true);
      },
      error: function (error) {
        video.resumeCreditsChecked = true;
        console.log(error);
      },
    });
  },

  // Timed skips from the skip-events payload. Known kinds keep a stable
  // order; any other object with a start and end is a skip too.
  loadSkipWindows: function (data) {
    var preferred = ["recap", "intro", "credits", "outro", "preview"];
    var seen = {};
    video.skipWindows = {};
    video.skipList = [];
    preferred.forEach(function (kind) {
      var segment = video.readSkipWindow(data[kind]);
      if (!segment) {
        return;
      }
      video.skipWindows[kind] = segment;
      video.skipList.push(kind);
      seen[kind] = true;
    });
    Object.keys(data).forEach(function (kind) {
      if (seen[kind]) {
        return;
      }
      var segment = video.readSkipWindow(data[kind]);
      if (!segment) {
        return;
      }
      video.skipWindows[kind] = segment;
      video.skipList.push(kind);
    });
    video.intro = video.skipWindows.intro || null;
    video.credits = video.skipWindows.credits || null;
  },

  readSkipWindow: function (entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    var start = Number(entry.start);
    var end = Number(entry.end);
    if (!isFinite(start) || !isFinite(end) || end <= start) {
      return null;
    }
    return { start: start, end: end, state: false };
  },

  playbackTime: function () {
    var time = 0;
    var media = document.getElementById("videoplayer");
    if (media && isFinite(media.currentTime)) {
      time = media.currentTime;
    }
    var pending = player.values && player.values.forward_rewind;
    if (isFinite(pending)) {
      time += pending;
    }
    if (!isFinite(time) || time < 0) {
      time = 0;
    }
    return time;
  },

  // The window that contains this time. If two overlap, the one that
  // started later is the current segment.
  skipAt: function (time) {
    var best = null;
    var list = video.skipList || [];
    for (var i = 0; i < list.length; i++) {
      var id = list[i];
      var segment = video.skipWindows[id];
      if (!segment || time < segment.start || time >= segment.end) {
        continue;
      }
      if (
        !best ||
        segment.start > best.segment.start ||
        (segment.start === best.segment.start && segment.end < best.segment.end)
      ) {
        best = { id: id, segment: segment };
      }
    }
    return best;
  },

  skipLabel: function (id) {
    var keys = {
      intro: "video.skip",
      recap: "video.skip_recap",
      credits: "video.skip_credits",
      outro: "video.skip_outro",
      preview: "video.skip_preview",
    };
    var key = keys[id];
    if (key) {
      var text = translate.go(key);
      if (text && text !== key) {
        return text;
      }
    }
    return "SKIP " + String(id).replace(/[_-]+/g, " ").toUpperCase();
  },

  skipShown: function () {
    var button = document.getElementById("skip-intro");
    var segment = video.skipKind && video.skipWindows[video.skipKind];
    if (!button || !segment || !segment.state) {
      return false;
    }
    return window.getComputedStyle(button).display !== "none";
  },

  focusSkip: function () {
    if (!video.skipKind) {
      return;
    }
    video.skipFocus = true;
    video.option = false;
    $("#setting-options").children().removeClass("selected");
    $("#skip-intro").addClass("selected");
    var osd = document.getElementById("osd");
    if (osd) {
      osd.classList.remove("transport-focus");
    }
  },

  clearSkipFocus: function () {
    video.skipFocus = false;
    $("#skip-intro").removeClass("selected");
  },

  releaseSkipFocus: function () {
    if (!video.skipFocus) {
      video.clearSkipFocus();
      return;
    }
    video.clearSkipFocus();
    var osd = document.getElementById("osd");
    if (!osd || video.option || video.speed.state) {
      return;
    }
    osd.classList.add("transport-focus");
    $("#setting-options .player-icon").removeClass("selected");
  },

  activateSkip: function () {
    var segment = video.skipKind && video.skipWindows[video.skipKind];
    if (!segment || !segment.state) {
      return false;
    }
    var end = segment.end;
    segment.state = false;
    video.skipKind = null;
    $("#skip-intro").hide();
    video.releaseSkipFocus();
    player.forwardTo(end);
    // Skip lands at the window end. The thumbnail clock has to match the
    // seconds still left, and the previous interval must not keep ticking.
    video.syncNextCountdown(end, true);
    return true;
  },

  showSkip: function (time, fromSeek) {
    var button = document.getElementById("skip-intro");
    if (!button) {
      return;
    }
    var match = video.skipAt(time);
    if (!match) {
      var wasFocused = video.skipFocus;
      Object.keys(video.skipWindows || {}).forEach(function (id) {
        video.skipWindows[id].state = false;
      });
      video.skipKind = null;
      $("#skip-intro").hide();
      if (wasFocused) {
        video.releaseSkipFocus();
      }
      return;
    }
    Object.keys(video.skipWindows).forEach(function (id) {
      video.skipWindows[id].state = id === match.id;
    });
    var changed = video.skipKind !== match.id;
    video.skipKind = match.id;
    var label = button.querySelector(".skip-label");
    if (label) {
      label.textContent = video.skipLabel(match.id);
    }
    $("#skip-intro").show();
    // A seek that passes through the intro still shows the button. It does
    // not take focus, so Left and Right keep moving the playhead.
    if (
      changed &&
      !fromSeek &&
      !video.option &&
      !video.settings.open &&
      !video.speed.state
    ) {
      video.focusSkip();
    }
  },

  setAudios: function () {
    video.renderOptions(
      "audios",
      video.audios.map((element) => ({
        label:
          session.languages.audios[element.name] ||
          session.usableLanguage(element.name, "en-US"),
        description:
          typeof element.original === "boolean"
            ? translate.go(
                element.original
                  ? "video.languages.audio_original"
                  : "video.languages.audio_dub"
              )
            : "",
        active: element.name === video.audio,
      }))
    );
  },

  setSubtitleSizes: function () {
    var current = subtitleOverlay.prefs().size;
    video.renderOptions(
      "subtitle-sizes",
      subtitleOverlay.prefChoices.size.map((size) => ({
            label: translate.go(`video.languages.size_${size}`),
            active: size === current,
          }))
    );
  },

  changeAudio: function (index) {
    video.play(
      {
        id: video.audios[index].id,
        exactSeconds: player.getPlayed(),
      },
      true
    );
  },

  savedScript: function () {
    var saved = session.storage.subtitleScript;
    if (saved === "off" || saved === "sub" || saved === "dub") {
      return saved;
    }
    var legacy = session.storage.dubSubtitle;
    if (legacy === "overlay-cc") {
      return "dub";
    }
    if (legacy === "overlay-full") {
      return "sub";
    }
    if (legacy === "overlay-signs" || legacy === "Disabled") {
      return "off";
    }
    return null;
  },

  signsEnabled: function () {
    var key = video.seriesTitle || "";
    var map = session.storage.signOverlay || {};
    return !key || map[key] !== false;
  },

  scriptCopy: function (name, info) {
    var unavailable = false;
    var description = `script_${name}_description`;
    if (name === "sub" && info && !info.hasOriginal) {
      description = "script_sub_none";
      unavailable = true;
    } else if (name === "dub" && info && !info.hasCaptions) {
      description = "script_dub_none";
      unavailable = true;
    }
    return {
      label: translate.go(`video.languages.script_${name}`),
      description: translate.go(`video.languages.${description}`),
      unavailable: unavailable,
    };
  },

  applyOverlayAvailability: function (episodeId, sources) {
    var info = subtitleOverlay.describe(sources);
    console.log(
      `[subtitles] ${episodeId}: script ${video.script}, sub script ${
        info.hasOriginal ? info.originalSigns + " sign cues" : "missing"
      }, dub script ${
        info.hasCaptions ? info.captionSigns + " sign cues" : "missing"
      }, hide dupes ${video.hideDupes ? "on" : "off"}`
    );
    video.scripts.forEach(function (element) {
      Object.assign(element, video.scriptCopy(element.name, info));
    });
    video.setSubtitles();
  },

  setSubtitles: function () {
    video.renderOptions(
      "subtitles",
      (video.scripts || []).map((element) => ({
        label: element.label,
        description: element.description || "",
        active: element.name === video.script,
        unavailable: !!element.unavailable,
      }))
    );
  },

  changeScript: function (index) {
    var target = video.scripts[index];
    if (!target || session.usableLanguage(target.name, "") === "") {
      return;
    }
    if (target.name !== "off" && target.name !== "sub" && target.name !== "dub") {
      return;
    }
    session.storage.subtitleScript = target.name;
    session.update();
    video.script = target.name;
    subtitleOverlay.setTrack(video.script, video.hideDupes);
  },

  toggleHideDupes: function () {
    video.hideDupes = !video.hideDupes;
    session.storage.hideDupes = video.hideDupes;
    session.update();
    $("#hide-dupes").toggleClass("on", video.hideDupes);
    subtitleOverlay.setTrack(video.script, video.hideDupes);
  },

  setSpeeds: function () {
    video.renderOptions(
      "speeds",
      video.speed.options.map(function (speed) {
        return {
          label: String(speed),
          active: speed === video.speed.active,
        };
      })
    );
  },

  chooseSpeed: function (index) {
    var speed = video.speed.options[index];
    if (speed == null) {
      return;
    }
    video.speed.active = speed;
    player.speed(speed);
    video.setSpeeds();
  },

  stopNext: function () {
    video.clearNextTimer();
    video.next.status = false;
    video.next.episode = null;
    $(".next-episode").hide();
  },

  clearNextTimer: function () {
    clearInterval(video.timers.next);
    video.timers.next = null;
  },

  // Where a clicked episode starts, in seconds.
  // Where a partial episode resumes. A finished episode never reaches
  // here. A playhead in the last minute, with more than 10 seconds left,
  // stays put. Anything earlier backs up 3 seconds.
  resumeStartSeconds: function (playhead, duration) {
    var position = isFinite(playhead) ? playhead : 0;
    if (position < 0) {
      position = 0;
    }
    var hasDuration =
      typeof duration === "number" && isFinite(duration) && duration > 0;
    if (hasDuration && position > duration) {
      position = duration;
    }
    if (hasDuration && position >= duration - 60) {
      return position;
    }
    var start = position - 3;
    if (start < 0) {
      start = 0;
    }
    return start;
  },

  // A finished playhead, the last 10 seconds, or an unwatched episode
  // starts at 00:00. A click stays on that episode. A partial playhead
  // with more than 10 seconds left resumes.
  shouldRestartOnHandoff: function (playhead, duration, item) {
    if (!item || item.watched === false) {
      return true;
    }
    if (item.fullyWatched || item.fully_watched) {
      return true;
    }
    if (!isFinite(playhead) || playhead <= 0) {
      return true;
    }
    if (
      isFinite(duration) &&
      duration > 0 &&
      playhead >= duration - 10
    ) {
      return true;
    }
    return false;
  },

  openingSeconds: function (item) {
    if (item && isFinite(item.exactSeconds)) {
      video.openingFromNext = false;
      video.resumeSource = null;
      video.resumeCreditsChecked = true;
      return item.exactSeconds < 0 ? 0 : item.exactSeconds;
    }
    var playhead = 0;
    if (item && isFinite(item.playheadSeconds)) {
      playhead = item.playheadSeconds;
    } else if (item && isFinite(item.playhead)) {
      playhead = item.playhead * 60;
    }
    var duration = NaN;
    if (item && isFinite(item.durationSeconds) && item.durationSeconds > 0) {
      duration = item.durationSeconds;
    } else if (item && isFinite(item.duration) && item.duration > 0) {
      duration = item.duration * 60;
    }
    video.resumeSource = playhead;
    if (video.shouldRestartOnHandoff(playhead, duration, item)) {
      video.resumeCreditsChecked = true;
      video.openedNearEnd = false;
      video.holdNextOnOpen = false;
      video.openTime = 0;
      video.suppressOpenEnd = false;
      return 0;
    }
    // A handoff still in the credits (more than 10 seconds left) waits for
    // the skip marker, then returns to 00:00. A click never does.
    video.resumeCreditsChecked = !video.openingFromNext;
    var nearEnd =
      isFinite(duration) && duration > 0 && playhead >= duration - 60;
    video.openedNearEnd = !video.openingFromNext && !!nearEnd && playhead > 10;
    video.holdNextOnOpen = !!nearEnd;
    video.openTime = playhead;
    var start = video.openingFromNext
      ? playhead < 0
        ? 0
        : playhead
      : video.resumeStartSeconds(playhead, duration);
    if (
      video.openingFromNext &&
      isFinite(duration) &&
      duration > 0 &&
      start > duration
    ) {
      start = duration;
    }
    video.suppressOpenEnd =
      isFinite(duration) && duration > 0 && start >= duration - 1;
    return start;
  },

  // Skip markers arrive after play() starts. On a next-episode handoff, a
  // saved playhead already inside the credits goes back to 00:00.
  correctOpeningResume: function () {
    if (
      !video.openingFromNext ||
      video.resumeCreditsChecked ||
      !isFinite(video.resumeSource)
    ) {
      video.resumeCreditsChecked = true;
      return;
    }
    var creditsStart = video.credits && video.credits.start;
    if (typeof creditsStart !== "number" || !isFinite(creditsStart)) {
      video.resumeCreditsChecked = true;
      return;
    }
    video.resumeCreditsChecked = true;
    if (video.resumeSource < creditsStart) {
      return;
    }
    var applied = video.resumeApplied;
    player.playhead = null;
    video.resumeApplied = 0;
    video.openedNearEnd = false;
    video.holdNextOnOpen = false;
    video.openTime = 0;
    video.suppressOpenEnd = false;
    video.hideResumeNote();
    var media = document.getElementById("videoplayer");
    if (!media || !isFinite(media.currentTime)) {
      return;
    }
    if (isFinite(applied) && Math.abs(media.currentTime - applied) < 5) {
      media.currentTime = 0;
    }
  },

  showResumeNote: function () {
    var note = document.getElementById("resume-note");
    if (!note) {
      return;
    }
    note.hidden = false;
    note.classList.add("is-shown");
    clearTimeout(video.timers.resumeNote);
    video.timers.resumeNote = setTimeout(function () {
      video.timers.resumeNote = null;
      video.hideResumeNote();
    }, 4500);
  },

  hideResumeNote: function () {
    clearTimeout(video.timers.resumeNote);
    video.timers.resumeNote = null;
    var note = document.getElementById("resume-note");
    if (!note) {
      return;
    }
    note.classList.remove("is-shown");
    note.hidden = true;
  },

  // Seconds until the episode ends at this playhead. Null until duration
  // is known, so a missing duration cannot be treated as zero.
  episodeSecondsLeft: function (time) {
    var duration = player.getDuration();
    if (!isFinite(time)) {
      time = video.playbackTime();
    }
    if (!isFinite(duration) || duration <= 0 || !isFinite(time)) {
      return null;
    }
    var left = duration - time;
    if (left < 0) {
      left = 0;
    }
    return left;
  },

  // Start of the stretch where the next-episode card counts: credits,
  // outro, or preview, through the end of the episode.
  endWindowStart: function () {
    var start = null;
    var kinds = ["credits", "outro", "preview"];
    for (var i = 0; i < kinds.length; i++) {
      var segment = video.skipWindows && video.skipWindows[kinds[i]];
      if (!segment || !isFinite(segment.start)) {
        continue;
      }
      if (start == null || segment.start < start) {
        start = segment.start;
      }
    }
    return start;
  },

  inEndWindow: function (time) {
    var start = video.endWindowStart();
    return start != null && isFinite(time) && time >= start;
  },

  // Seconds of the episode still left. The credits marker only decides when
  // the card appears. Counting the credits window reached 0 when that marker
  // ended, about a minute before the file did, and the old clamp kept it there.
  nextCountValue: function (time) {
    if (!isFinite(time)) {
      time = video.playbackTime();
    }
    var left = video.episodeSecondsLeft(time);
    if (left == null || !isFinite(left)) {
      return null;
    }
    if (left < 0) {
      left = 0;
    }
    return Math.floor(left);
  },

  // The next-episode card is visible only while currentTime is at or past
  // the credits marker and the viewer has not dismissed it. Rewinding below
  // that marker hides the card and clears the dismiss flag and the timer.
  syncNextCard: function (time, seeked) {
    if (!isFinite(time)) {
      time = video.playbackTime();
    }
    if (video.holdNextOnOpen) {
      var advanced =
        isFinite(video.openTime) && time > video.openTime + 0.75;
      var rewound = isFinite(video.openTime) && time < video.openTime - 1;
      if (!advanced && !rewound) {
        return;
      }
      video.holdNextOnOpen = false;
    }
    var creditsStart =
      video.credits && typeof video.credits.start === "number" && isFinite(video.credits.start)
        ? video.credits.start
        : null;
    if (creditsStart == null || time < creditsStart) {
      video.next.dismissed = false;
      video.next.shown = false;
      video.next.status = false;
      video.clearNextTimer();
      var count = document.getElementById("next-episode-count");
      if (count) {
        count.innerText = "";
      }
      $(".next-episode").hide();
      return;
    }
    if (video.next.dismissed) {
      video.clearNextTimer();
      $(".next-episode").hide();
      return;
    }
    if (!video.next.shown) {
      if (player.state === player.states.PLAYING) {
        video.nextEpisode();
      }
      return;
    }
    if (!video.next.status) {
      return;
    }
    $(".next-episode").show();
    video.syncNextCountdown(time, !!seeked);
  },

  onSeeked: function () {
    if (!document.getElementById(video.id)) {
      return;
    }
    video.syncNextCard(video.playbackTime(), true);
  },

  startNextTimer: function () {
    video.clearNextTimer();
    video.timers.next = setInterval(function () {
      var time = video.playbackTime();
      if (video.inEndWindow(time)) {
        video.syncNextCountdown(time, false);
        return;
      }
      var node = document.getElementById("next-episode-count");
      if (!node) {
        video.clearNextTimer();
        return;
      }
      var value = parseInt(node.innerText, 10);
      if (!isFinite(value) || value <= 0) {
        video.clearNextTimer();
        return;
      }
      var next = value - 1;
      var left = video.episodeSecondsLeft(time);
      if (left != null) {
        next = Math.min(next, Math.floor(left));
      }
      if (next < 0) {
        next = 0;
      }
      node.innerText = String(next);
      if (next <= 0) {
        video.clearNextTimer();
      }
    }, 1000);
  },

  // Point the thumbnail countdown at the seconds still left in the episode.
  // `restart` drops the running interval so a seek cannot leave the old
  // clock ticking.
  syncNextCountdown: function (time, restart) {
    if (!isFinite(time)) {
      time = video.playbackTime();
    }
    if (!video.inEndWindow(time)) {
      return;
    }
    var count = video.nextCountValue(time);
    var node = document.getElementById("next-episode-count");
    if (count == null || !node) {
      if (restart && video.next.status) {
        video.startNextTimer();
      }
      return;
    }
    if (String(node.innerText) !== String(count)) {
      node.innerText = String(count);
    }
    if (!video.next.status) {
      return;
    }
    if (count <= 0) {
      video.clearNextTimer();
      return;
    }
    if (restart || !video.timers.next) {
      video.startNextTimer();
    }
  },

  playNext: function () {
    video.saveHistory(Math.floor(player.getDuration()));
    video.handoffNext = true;
    video.play(video.next.episode);
    $(".osd #title").text(video.next.episode.serie);
    $(".osd #subtitle").text(video.episodeLabel(video.next.episode));
  },

  // First press returns to 00:00. Within 10 seconds of the start, or on a
  // second press before that seek lands, it loads the previous episode.
  // Watching past those 10 seconds clears the second-press arm.
  restartOrPrevious: function () {
    var time = video.playbackTime();
    if (video.armedPrevious || time <= 10) {
      video.armedPrevious = false;
      video.sawStart = false;
      video.previousEpisode();
      return;
    }
    video.armedPrevious = true;
    video.sawStart = false;
    clearTimeout(player.timers.forward_rewind);
    player.values.forward_rewind = 0;
    var media = document.getElementById("videoplayer");
    if (media) {
      media.currentTime = 0;
    }
    video.setPlayingTime();
  },

  previousEpisode: function () {
    service.previous({
      data: {
        ids: video.episode,
      },
      success: function (data) {
        if (!data || !data.data || !data.data[0] || !data.data[0].panel) {
          return;
        }
        var item = mapper.continue(data);
        if (!item || !item.id || item.id === video.episode) {
          return;
        }
        video.saveHistory(Math.floor(player.getPlayed()));
        video.play(item);
        $(".osd #title").text(item.serie || "");
        $(".osd #subtitle").text(video.episodeLabel(item));
      },
      error: function (error) {
        console.log(error);
      },
    });
  },

  nextEpisode: function (instant) {
    video.next.shown = true;
    try {
      service.continue({
        data: {
          ids: video.episode,
        },
        success: function (data) {
          var episode = null;
          try {
            episode = mapper.continue(data);
          } catch (error) {
            episode = null;
          }
          if (!episode || !episode.id || episode.id === video.episode) {
            video.next.shown = false;
            video.next.status = false;
            if (instant || video.advanceOnReady) {
              video.destroy();
            }
            return;
          }
          if (!instant && !video.advanceOnReady) {
            if (video.next.dismissed) {
              video.next.shown = false;
              return;
            }
            var time = video.playbackTime();
            var creditsStart = video.credits && video.credits.start;
            if (typeof creditsStart !== "number" || !isFinite(creditsStart) || time < creditsStart) {
              video.next.shown = false;
              video.next.status = false;
              $(".next-episode").hide();
              video.clearNextTimer();
              return;
            }
          }
          video.next.episode = episode;

          if (instant || video.advanceOnReady) {
            video.playNext();
          } else {
            document
              .getElementById("next-episode-image")
              .setAttribute("src", video.next.episode.background);
            $(".next-episode").show();
            video.next.status = true;
            var time = video.playbackTime();
            if (video.inEndWindow(time)) {
              video.syncNextCountdown(time, true);
            } else {
              video.startNextTimer();
            }
          }
        },
        error: function (error) {
          video.next.shown = false;
          video.next.status = false;
          if (instant || video.advanceOnReady) {
            video.destroy();
            return;
          }
          console.log(error);
        },
      });
    } catch (error) {
      console.log(error);
    }
  },

  playbackSpeed: function () {
    if (!video.speed.state) {
      var speedsOptions = `
        <ul id="speed-menu">
          <span></span>
          ${video.speed.options.map((e) => "<li>" + e + "</li>").join("")}
        </ul>
      `;

      video.speed.state = true;
      video.showOSD(true);
      $("#setting-options").hide();
      $(".player-settings").append(speedsOptions);

      video.setSpeed(0);
      return true;
    }
    video.hidePlaySpeed();
    video.showOSD();
    return false;
  },

  hidePlaySpeed: function () {
    $("#speed-menu").remove();
    $("#setting-options").show();
    video.speed.state = false;
  },

  setSpeed: function (increment) {
    var index = video.speed.options.indexOf(video.speed.active);
    var newIndex = index + increment;
    if (newIndex >= 0 && newIndex < video.speed.options.length) {
      if (newIndex === 3) {
        var count = 0;
        var width = 50;
        $("#speed-menu").removeClass("to-rigth");
        $("#speed-menu").removeClass("to-left");
        var classDirection = "";
      } else if (newIndex > 3) {
        var count = newIndex - 3;
        var width = 50 + count * 75;
        var classDirection = "to-rigth";
      } else {
        var count = 3 - newIndex;
        var width = 50 + count * 75;
        var classDirection = "to-left";
      }

      $("#speed-menu").addClass(classDirection);
      $("#speed-menu span").css("width", width);

      video.speed.active = video.speed.options[newIndex];
      player.speed(video.speed.options[newIndex]);
    }
  },

  showOSD: function (noHide) {
    if (!document.getElementById("osd")) {
      return;
    }
    clearTimeout(video.timers.osd.object);
    var osd = document.getElementById("osd");
    osd.style.opacity = 1;
    // The seek bar is the transport focus target: Left/Right scrub, Enter
    // toggles play/pause. Up moves to the visible skip (intro, recap,
    // credits, outro, or preview) when one is on screen, then to the
    // top-right icons.
    var transport =
      !video.option && !video.skipFocus && !video.speed.state;
    if (transport) {
      $("#setting-options .player-icon").removeClass("selected");
    }
    osd.classList.toggle("transport-focus", transport);
    video.leaveStill();
    video.syncCenter();
    // A pause leaves the transport up. Playing again uses the usual hide timer.
    // Ten seconds into a pause, the still frame replaces every overlay.
    if (!noHide && !video.userPaused) {
      video.timers.osd.object = setTimeout(() => {
        video.hideOSD();
      }, video.timers.osd.duration);
    }
    video.armStill();
  },

  armStill: function () {
    clearTimeout(video.timers.still);
    video.timers.still = null;
    if (
      !video.userPaused ||
      video.settings.open ||
      video.speed.state ||
      video.leaving
    ) {
      return;
    }
    video.timers.still = setTimeout(function () {
      video.timers.still = null;
      if (!video.userPaused || video.settings.open || video.speed.state) {
        return;
      }
      var screen = document.getElementById(video.id);
      if (!screen) {
        return;
      }
      screen.classList.add("is-still");
      video.hideOSD();
    }, 10000);
  },

  leaveStill: function () {
    clearTimeout(video.timers.still);
    video.timers.still = null;
    var screen = document.getElementById(video.id);
    if (screen) {
      screen.classList.remove("is-still");
    }
  },

  hideOSD: function () {
    clearTimeout(video.timers.osd.object);
    video.option = false;
    $("#setting-options").children().removeClass("selected");
    if (!video.skipShown()) {
      video.clearSkipFocus();
    }
    video.timers.osd.object = null;
    var osd = document.getElementById("osd");
    if (!osd) {
      return;
    }
    osd.style.opacity = 0;
  },

  showBTN: function (state) {
    if (state === "loading") {
      video.armSpinner();
      return;
    }
    video.flashTransport(state);
  },

  hideBTN: function () {
    video.clearSpinner();
    video.syncCenter();
  },

  // The center slot is either the play glyph or the spinner, never both.
  // A stall under half a second keeps the glyph.
  armSpinner: function () {
    var screen = document.getElementById(video.id);
    if (!screen) {
      return;
    }
    if (video.timers.spinner || video.buffering) {
      return;
    }
    video.timers.spinner = setTimeout(function () {
      video.timers.spinner = null;
      var current = document.getElementById(video.id);
      var media = document.getElementById("videoplayer");
      if (!current) {
        return;
      }
      if (media && media.readyState >= 3 && !media.seeking) {
        return;
      }
      video.occupyCenter("spinner");
    }, 500);
  },

  clearSpinner: function () {
    clearTimeout(video.timers.spinner);
    video.timers.spinner = null;
    video.occupyCenter("glyph");
  },

  occupyCenter: function (mode) {
    var spinning = mode === "spinner";
    video.buffering = spinning;
    var screen = document.getElementById(video.id);
    if (screen) {
      screen.classList.toggle("is-buffering", spinning);
    }
    var center = document.querySelector("#video-screen .osd-center");
    if (center) {
      center.style.visibility = spinning ? "hidden" : "";
    }
    var spinner = document.getElementById("osd-icon");
    if (spinner) {
      spinner.className = spinning ? "icon-status loading" : "icon-status";
      spinner.style.visibility = spinning ? "visible" : "hidden";
      spinner.style.opacity = spinning ? "1" : "0";
    }
  },

  // The center rewind, forward, and pause glyphs stay hidden. Pause is the
  // pair of bars on the elapsed time. The seek bar shows the move.
  flashTransport: function () {},

  syncCenter: function () {
    var osd = document.getElementById("osd");
    if (osd) {
      osd.classList.toggle("is-paused", !!video.userPaused);
    }
    var play = document.querySelector("#video-screen .osd-play");
    if (play) {
      play.classList.toggle("is-paused", !!video.userPaused);
    }
  },

  setScrubHold: function (dir) {
    var osd = document.getElementById("osd");
    if (!osd) {
      return;
    }
    osd.classList.toggle("scrub-hold", !!dir);
    osd.classList.toggle("scrub-back", dir < 0);
    osd.classList.toggle("scrub-forward", dir > 0);
  },

  // Enter toggles playback. During a held seek, pause plays from here.
  togglePlay: function (action) {
    if (player.scrub && player.scrub.dir) {
      player.finishScrub(true);
      video.userPaused = false;
      video.syncCenter();
      return;
    }
    player[action]();
    video.userPaused =
      player.state === player.states.PAUSED && !video.settings.open;
    video.syncCenter();
  },

  startHistory: function () {
    clearInterval(video.timers.history.object);
    video.timers.history.object = setInterval(() => {
      video.saveHistory();
    }, video.timers.history.duration);
  },

  saveHistory: function (time) {
    service.setHistory({
      data: {
        content_id: video.episode,
        playhead: time || Math.floor(player.getPlayed()),
      },
      success: function () {},
      error: function (error) {
        console.log(error);
      },
    });
  },

  setPlayingTime: function () {
    if (!document.getElementById("played")) {
      return;
    }
    var time = player.getPlayed() + player.values.forward_rewind;
    time = time < 0 ? 0 : time;
    var totalTime = player.getDuration();
    var timePercent = totalTime > 0 ? (100 * time) / totalTime : 0;
    if (!isFinite(timePercent)) {
      timePercent = 0;
    }
    var bar = document.querySelector("#video-screen .osd .progress .bar");
    if (bar) {
      bar.style.setProperty("--progress", timePercent + "%");
    }

    if (video.suppressOpenEnd && isFinite(totalTime) && time < totalTime - 2) {
      video.suppressOpenEnd = false;
    }

    if (video.armedPrevious) {
      if (time <= 10) {
        video.sawStart = true;
      } else if (video.sawStart) {
        video.armedPrevious = false;
        video.sawStart = false;
      }
    }

    var seeked =
      video.lastTime != null && Math.abs(time - video.lastTime) > 1.5;
    video.lastTime = time;
    video.syncNextCard(time, seeked);

    video.showSkip(time, seeked);
    var knob = bar && bar.querySelector(".knob");
    if (knob) {
      var barWidth = bar.clientWidth;
      var knobWidth = knob.offsetWidth || 22;
      var x = barWidth * (timePercent / 100);
      var edge = knobWidth / 2;
      if (!(barWidth > knobWidth)) {
        x = edge;
      } else if (x < edge) {
        x = edge;
      } else if (x > barWidth - edge) {
        x = barWidth - edge;
      }
      knob.style.left = x + "px";
    }

    var totalSeconds = Math.floor(totalTime % 60);
    var totalMinutes = Math.floor((totalTime % 3600) / 60);
    var totalHours = Math.floor(totalTime / 3600);
    totalHours = totalHours < 10 ? "0" + totalHours : totalHours;
    totalMinutes = totalMinutes < 10 ? "0" + totalMinutes : totalMinutes;
    totalSeconds = totalSeconds < 10 ? "0" + totalSeconds : totalSeconds;

    var timeSeconds = Math.floor(time % 60);
    var timeMinutes = Math.floor((time % 3600) / 60);
    var timeHours = Math.floor(time / 3600);
    timeHours = timeHours < 10 ? "0" + timeHours : timeHours;
    timeMinutes = timeMinutes < 10 ? "0" + timeMinutes : timeMinutes;
    timeSeconds = timeSeconds < 10 ? "0" + timeSeconds : timeSeconds;

    var timeText = `${timeHours ? timeHours : "00"}:${
      timeMinutes ? timeMinutes : "00"
    }:${timeSeconds ? timeSeconds : "00"}`;
    document.getElementById("time").innerText = timeText;
    document.getElementById("knob-time").innerText = timeText;
    document.getElementById("total").innerText = `${
      totalHours ? totalHours : "00"
    }:${totalMinutes ? totalMinutes : "00"}:${
      totalSeconds ? totalSeconds : "00"
    }`;
    document.getElementById("played").style.width = timePercent + "%";
  },
};
