window.home_details = {
  id: "home_details-screen",
  previous: NaN,
  data: {
    this: NaN,
    continue: NaN,
  },
  similarItems: [],
  similarIndex: 0,
  similarFocus: false,
  callbacks: {
    init: NaN,
    destroy: NaN,
  },

  init: function (item, init, destroy) {
    if (window.home && home.stopCarousel) {
      home.stopCarousel();
    }
    home_details.callbacks.init = init;
    home_details.callbacks.destroy = destroy;
    home_details.callbacks.init && home_details.callbacks.init(item);
    service.inWatchList({
      data: item.id,
      success: function (response) {
        home_details.inWatchList = response.data.length > 0;
        if (!home_details.inWatchList) {
          var content = `<i class="fa-regular fa-bookmark"></i>
          <p>${translate.go("home.details.add")}</p>`;
        } else {
          var content = `<i class="fa-solid fa-bookmark"></i>
          <p>${translate.go("home.details.remove")}</p>`;
        }
        document.getElementById("watchlist-status").innerHTML = content;
      },
      error: function (error) {
        home_details.inWatchList = false;
        console.log(error);
      },
    });
    var buttons = document.createElement("div");
    buttons.className = `${home_details.id} ${home_details.id}_buttons`;
    buttons.innerHTML = `
    <a class="selected">
      <i class="fa-solid fa-play"></i>
      <p>${translate.go("home.details.play", { season: 1, episode: 1 })}</p>
      <span></span>
    </a>
    <a id="watchlist-status">
      <i class="fa-regular fa-bookmark"></i>
      <p>${translate.go("home.details.add")}</p>
    </a>
    <a>
      <i class="fa-solid fa-list"></i>
      <p>${translate.go("home.details.episodes")}</p>
    </a>`;

    home_details.data.this = item;
    if (window.home && home.applyCopy) {
      home.applyCopy(item);
    }
    var summary = document.querySelector(
      "#" + home.id + " .details .info .description"
    );
    if (summary) {
      summary.textContent = item.description || "";
    }
    $(`#${home.id} .details .info`).append(buttons);
    home_details.loadScore(item);
    home_details.loadSimilar(item);

    if (item.type === "movie") {
      $(`.${home_details.id}.${home_details.id}_buttons a`).eq(2).remove();
      $(`.${home_details.id}.${home_details.id}_buttons a`)
        .eq(0)
        .addClass(`${item.playhead > 0 ? "played" : ""}`)
        .attr("percent", (item.playhead * 100) / item.duration);

      var text = translate.go(
        `home.details.${item.playhead > 0 ? "continue" : "play"}`,
        { season: 0, episode: 0 }
      );
      $(`.${home_details.id}.${home_details.id}_buttons a p`).eq(0).text(text);
      $(`.${home_details.id}.${home_details.id}_buttons a span`)
        .eq(0)
        .width((item.playhead * 100) / item.duration + "%");
    } else {
      var saved = home_details.savedEpisode(item);
      if (saved) {
        home_details.showContinue(saved);
      } else {
        loading.start();
        service.continue({
          data: {
            ids: item.id,
          },
          success: function (response) {
            loading.end();
            try {
              home_details.showContinue(mapper.continue(response));
            } catch (error) {
              console.log(error);
            }
          },
          error: function (error) {
            loading.end();
            console.log(error);
          },
        });
      }
    }

    $(`#${home.id} .details`).addClass("full");
    $(`body`).addClass(`${home_details.id}`);

    home_details.previous = main.state;
    main.state = home_details.id;
  },

  // The episode on the thumbnail. History and continue cards carry episodeId.
  // Up-next is not used here: a playhead near the end must not become the next episode.
  savedEpisode: function (item) {
    if (!item || !item.episodeId) {
      return null;
    }
    var seconds = 0;
    if (isFinite(item.playheadSeconds)) {
      seconds = item.playheadSeconds;
    } else if (isFinite(item.playhead)) {
      seconds = item.playhead * 60;
    }
    if (seconds < 0) {
      seconds = 0;
    }
    var durationSeconds = NaN;
    if (isFinite(item.durationSeconds) && item.durationSeconds > 0) {
      durationSeconds = item.durationSeconds;
    } else if (isFinite(item.duration) && item.duration > 0) {
      durationSeconds = item.duration * 60;
    }
    var played =
      isFinite(durationSeconds) && durationSeconds > 0
        ? (seconds * 100) / durationSeconds
        : 0;
    return {
      id: item.episodeId,
      stream: item.stream || item.episodeId,
      serie: item.serie || item.title || "",
      episode: item.episode || "",
      season_number: item.season_number || 0,
      episode_number: item.episode_number || 0,
      description: item.description || "",
      background: item.background || "",
      seriesId: item.seriesId || item.id || "",
      playheadSeconds: seconds,
      durationSeconds: durationSeconds,
      playhead: isFinite(item.playhead) ? item.playhead : Math.round(seconds / 60),
      duration: isFinite(item.duration)
        ? item.duration
        : isFinite(durationSeconds)
          ? Math.round(durationSeconds / 60)
          : 0,
      fullyWatched: !!(item.fullyWatched || item.fully_watched),
      played: played,
    };
  },

  showContinue: function (item) {
    if (!item) {
      return;
    }
    home_details.data.continue = item;
    var percent = Number(item.played);
    if (!isFinite(percent) || percent < 0) {
      percent = 0;
    }
    if (percent > 100) {
      percent = 100;
    }
    var underway = percent > 0;
    $(`.${home_details.id}.${home_details.id}_buttons a`)
      .eq(0)
      .addClass(`${underway ? "played" : ""}`)
      .attr("percent", underway ? percent : 0);

    var text = translate.go(
      `home.details.${underway ? "continue" : "play"}`,
      {
        season: item.season_number,
        episode: item.episode_number,
      }
    );
    $(`.${home_details.id}.${home_details.id}_buttons a p`).eq(0).text(text);
    $(`.${home_details.id}.${home_details.id}_buttons a span`)
      .eq(0)
      .width((underway ? percent : 0) + "%");
  },

  // Audience score only. `rating.average` is the star average (a number like
  // 4.8). Maturity labels such as TV-14 live on other fields and are ignored.
  audienceScore: function (payload) {
    var rows = [];
    if (payload && payload.data && payload.data.length) {
      rows.push(payload.data[0]);
    } else if (payload) {
      rows.push(payload);
    }
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var candidates = [row, row && row.panel];
      for (var j = 0; j < candidates.length; j++) {
        var source = candidates[j];
        if (!source || !source.rating || typeof source.rating !== "object") {
          continue;
        }
        if (source.rating.average == null || source.rating.average === "") {
          continue;
        }
        var value = Number(source.rating.average);
        if (!isFinite(value) || value <= 0 || value > 5) {
          continue;
        }
        return (Math.round(value * 10) / 10).toFixed(1);
      }
    }
    return "";
  },

  loadScore: function (item) {
    home_details.scoreRequest = (home_details.scoreRequest || 0) + 1;
    var scoreRequest = home_details.scoreRequest;
    var ready = home_details.audienceScore(item);
    if (ready) {
      home_details.showScore(ready);
      return;
    }
    if (!item || !item.id) {
      return;
    }
    service.object({
      data: item.id,
      success: function (response) {
        if (scoreRequest !== home_details.scoreRequest) {
          return;
        }
        if (main.state !== home_details.id) {
          return;
        }
        home_details.showScore(home_details.audienceScore(response));
      },
      error: function (error) {
        console.log(error);
      },
    });
  },

  showScore: function (label) {
    home.placeScore(label);
  },

  similarList: function (payload, seriesId) {
    var list = [];
    if (payload && Array.isArray(payload.data)) {
      list = payload.data;
    } else if (payload && Array.isArray(payload.items)) {
      list = payload.items;
    } else if (Array.isArray(payload)) {
      list = payload;
    }
    var seen = {};
    var items = mapper.mapItems(list).filter(function (item) {
      if (!item || !item.id || !item.title || item.id === seriesId || seen[item.id]) {
        return false;
      }
      seen[item.id] = true;
      return true;
    });
    if (window.localShelves && localShelves.sinkWatched) {
      items = localShelves.sinkWatched(items, localShelves.currentWatched());
    }
    return items;
  },

  loadSimilar: function (item) {
    home_details.similarRequest = (home_details.similarRequest || 0) + 1;
    var similarRequest = home_details.similarRequest;
    if (!item || !item.id) {
      return;
    }
    service.similar({
      data: {
        id: item.id,
        n: 15,
      },
      success: function (response) {
        if (similarRequest !== home_details.similarRequest) {
          return;
        }
        if (main.state !== home_details.id) {
          return;
        }
        home_details.showSimilar(home_details.similarList(response, item.id));
      },
      error: function (error) {
        console.log(error);
      },
    });
  },

  showSimilar: function (items) {
    if (!items || !items.length || document.getElementById("home-similar")) {
      return;
    }
    var content = document.querySelector("#" + home.id + " .content");
    if (!content) {
      return;
    }
    var html = "";
    items.forEach(function (entry) {
      html += home.createItem(entry);
    });
    for (var i = 0; i < 9; i++) {
      html += home.createEmptyItem(items[0].display || "serie");
    }
    var wrap = document.createElement("div");
    wrap.id = "home-similar";
    wrap.className = "similar-row";
    wrap.innerHTML =
      '<div class="row"><div class="row-title">More like this</div><div class="row-content ' +
      (items[0].display || "serie") +
      '">' +
      html +
      "</div></div>";
    content.appendChild(wrap);
    document.body.classList.add("has-similar");
    home_details.similarItems = items;
    home_details.similarIndex = 0;
    var slides = items[0].display === "episode" ? 5.5 : 10;
    $(wrap.querySelector(".row-content")).slick(
      shelf.railOptions({ slidesToShow: slides })
    );
  },

  focusSimilar: function () {
    var row = document.querySelector("#home-similar .row-content");
    if (!row || !row.slick || !home_details.similarItems.length) {
      return false;
    }
    home_details.similarFocus = true;
    $(`.${home_details.id}.${home_details.id}_buttons a`).removeClass("selected");
    row.classList.add("selected");
    return true;
  },

  blurSimilar: function () {
    home_details.similarFocus = false;
    var row = document.querySelector("#home-similar .row-content");
    if (row) {
      row.classList.remove("selected");
    }
    var buttons = $(`.${home_details.id}.${home_details.id}_buttons a`);
    buttons.removeClass("selected");
    if (buttons.length) {
      buttons.eq(buttons.length - 1).addClass("selected");
    }
  },

  moveSimilar: function (dir) {
    var row = document.querySelector("#home-similar .row-content");
    if (!row || !row.slick) {
      return;
    }
    var max = home_details.similarItems.length - 1;
    var next = home_details.similarIndex + dir;
    if (next < 0) {
      next = 0;
    }
    if (next > max) {
      next = max;
    }
    home_details.similarIndex = next;
    row.slick.slickGoTo(next);
  },

  openSimilar: function () {
    var item = home_details.similarItems[home_details.similarIndex];
    if (!item) {
      return;
    }
    var root = document.getElementById(home.id);
    home_details.destroy();
    if (root && window.shelf) {
      shelf.swapBanner(root, item);
    }
    home_details.init(item);
  },

  clearSimilar: function () {
    home_details.similarRequest = (home_details.similarRequest || 0) + 1;
    var row = document.querySelector("#home-similar .row-content");
    if (row && row.slick) {
      $(row).slick("unslick");
    }
    var existing = document.getElementById("home-similar");
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    document.body.classList.remove("has-similar");
    home_details.similarItems = [];
    home_details.similarIndex = 0;
    home_details.similarFocus = false;
  },

  destroy: function () {
    home_details.scoreRequest = (home_details.scoreRequest || 0) + 1;
    home_details.clearSimilar();
    $(`body`).removeClass(`${home_details.id}`);
    $(`#${home.id} .details.full`).removeClass("full");
    $(`#${home.id} .details .info .rating`).remove();
    $(`.${home_details.id}`).remove();
    home_details.data.continue = NaN;
    home_details.data.this = NaN;
    home_details.inWatchList = false;

    main.state = home_details.previous;
    if (
      home_details.previous === home.id &&
      window.home &&
      home.position === 0
    ) {
      $(`#${home.id} .details`).addClass("full");
      if (home.focusPlay) {
        home.focusPlay();
      }
    }
    if (
      home_details.previous === home.id &&
      window.home &&
      home.show_details &&
      document.getElementById(home.id)
    ) {
      home.show_details();
    }
    home_details.callbacks.destroy && home_details.callbacks.destroy();
  },

  keyDown: function (event) {
    switch (event.keyCode) {
      case tvKey.IS_KEY_BACK(event.keyCode):
        home_details.destroy();
        break;
      case tvKey.KEY_UP:
        if (home_details.similarFocus) {
          home_details.blurSimilar();
          break;
        }
        var buttons = $(`.${home_details.id}.${home_details.id}_buttons a`);
        var current = buttons.index(
          $(`.${home_details.id}.${home_details.id}_buttons a.selected`)
        );
        buttons.removeClass("selected");
        buttons.eq(current > 0 ? current - 1 : current).addClass("selected");
        break;
      case tvKey.KEY_DOWN:
        if (home_details.similarFocus) {
          break;
        }
        var buttons = $(`.${home_details.id}.${home_details.id}_buttons a`);
        var current = buttons.index(
          $(`.${home_details.id}.${home_details.id}_buttons a.selected`)
        );
        if (current >= buttons.length - 1 && home_details.focusSimilar()) {
          break;
        }
        buttons.removeClass("selected");
        buttons
          .eq(current < buttons.length - 1 ? current + 1 : current)
          .addClass("selected");
        break;
      case tvKey.KEY_LEFT:
        if (home_details.similarFocus) {
          home_details.moveSimilar(-1);
        }
        break;
      case tvKey.KEY_RIGHT:
        if (home_details.similarFocus) {
          home_details.moveSimilar(1);
        }
        break;
      case tvKey.KEY_ENTER:
      case tvKey.KEY_PANEL_ENTER:
        if (home_details.similarFocus) {
          home_details.openSimilar();
          break;
        }
        var buttons = $(`.${home_details.id}.${home_details.id}_buttons a`);
        var current = buttons.index(
          $(`.${home_details.id}.${home_details.id}_buttons a.selected`)
        );

        switch (current) {
          case 0:
            video.init(home_details.data.continue);
            break;
          case 1:
            loading.start();
            mylist.toggleStatus(
              home_details.data.this.id,
              !home_details.inWatchList,
              {
                success: function () {
                  home_details.inWatchList = !home_details.inWatchList;
                  if (!home_details.inWatchList) {
                    var content = `<i class="fa-regular fa-bookmark"></i>
                    <p>${translate.go("home.details.add")}</p>`;
                  } else {
                    var content = `<i class="fa-solid fa-bookmark"></i>
                    <p>${translate.go("home.details.remove")}</p>`;
                  }
                  document.getElementById("watchlist-status").innerHTML = content;
                  loading.end();
                },
                error: function (error) {
                  console.log(error);
                  loading.end();
                },
              }
            );
            break;
          case 2:
            home_episodes.init(home_details.data.this);
            break;
          case 3:
            console.log("related");
            break;
        }
        break;
    }
  },
};
