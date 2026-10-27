window.home_episodes = {
  id: "home_episodes-screen",
  previous: NaN,
  data: {
    seasons: NaN,
    episodes: NaN,
  },

  init: function (item) {
    var episode_contents = document.createElement("div");
    episode_contents.className = `${home_episodes.id} ${home_episodes.id}_content`;

    episode_contents.innerHTML = `
    <div class="option seasons">
      <div class="title resize">${item.title}</div>
      <div class="seasons-list">
        <div id="seasons-list-offset"></div>
      </div>
    </div>
    <div class="option episodes">
      <div class="title"></div>
      <div class="episodes-list"></div>
    </div>
    `;

    $(`#${home.id}`).append(episode_contents);

    loading.start();
    service.seasons({
      data: {
        id: item.id,
      },
      success: function (response) {
        loading.end();
        home_episodes.data.seasons = mapper.seasons(response);
        home_episodes.renderSeasons(null);
        if (home_episodes.data.seasons.length) {
          home_episodes.load(home_episodes.data.seasons[0]);
        }
        service.latestWatchedSeason({
          seriesId: item.id,
          success: function (seasonNumber) {
            if (main.state !== home_episodes.id) {
              return;
            }
            home_episodes.renderSeasons(seasonNumber);
          },
        });
      },
      error: function (error) {
        loading.end();
        console.log(error);
      },
    });

    home_episodes.seriesId = item.id;
    $(`body`).addClass(`${home_episodes.id}`);

    home_episodes.previous = main.state;
    main.state = home_episodes.id;
  },

  load: function (season) {
    if (!season) {
      return;
    }
    $(".episodes").eq(0).removeClass("ready");
    $(".episodes .title")[0].innerText = `${season.number}. ${season.title}`;
    $(".episodes .episodes-list")[0].slick &&
      $(".episodes .episodes-list")[0].slick.destroy();
    $(".episodes .episodes-list")[0].innerHTML = "";
    loading.start();
    service.episodes({
      data: {
        id: season.id,
      },
      success: function (response) {
        mapper.episodes(response, function (result) {
          home_episodes.data.episodes = result;

          var episodes_html = "";
          home_episodes.data.episodes.forEach((episode) => {
            episodes_html += `
            <div class="episode">
              <div class="episode-image">
                <img src="${episode.background}">
                ${home_episodes.view(episode)}
              </div>
              <div class="episode-details">
                <div class="episode-title">${episode.episode_number}. ${episode.title}</div>
                <div class="episode-description">${episode.description}</div>
              </div>
            </div>`;
          });
          for (var index = 0; index < 4; index++) {
            episodes_html += `
            <div class="episode">
              <div class="episode-image">
                <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=">
              </div>
            </div>`;
          }
          $(".episodes .episodes-list").eq(0).html(episodes_html);

          $(".episodes .episodes-list").slick({
            vertical: true,
            dots: false,
            arrows: false,
            infinite: false,
            slidesToShow: 5,
            slidesToScroll: 1,
            speed: 0,
            waitForAnimate: false,
          });

          $(".episodes .episodes-list")[0].slick.slickGoTo(0);
          var episodesColumn = $(".episodes").eq(0);
          if (!$(".home_episodes-screen_content .option.active").length) {
            episodesColumn.addClass("active");
          }
          episodesColumn.addClass("ready");
          loading.end();
        });
      },
      error: function (error) {
        loading.end();
        console.log(error);
      },
    });
  },

  renderSeasons: function (lastNumber) {
    var seasons = home_episodes.data.seasons || [];
    var nodes = $(".seasons-list .season");
    var selected = nodes.length ? nodes.index(nodes.filter(".selected")) : 0;
    var active = nodes.length ? nodes.index(nodes.filter(".active")) : 0;
    if (selected < 0) selected = 0;
    var html = "";
    seasons.forEach(function (season, index) {
      var classes = "season";
      if (index === selected) classes += " selected";
      if (index === active) classes += " active";
      var last =
        lastNumber != null && Number(season.number) === Number(lastNumber);
      if (last) classes += " last";
      var pill = last
        ? '<span class="last-watched">' +
          translate.go("home.episodes.last_watched") +
          "</span>"
        : "";
      html +=
        '<div class="' +
        classes +
        '"><span class="season-name">' +
        season.number +
        ". " +
        season.title +
        "</span>" +
        pill +
        "</div>";
    });
    $(".seasons #seasons-list-offset").eq(0).html(html);
  },

  view: function (episode) {
    return mapper.progressPill(episode);
  },

  destroy: function () {
    var overlay = document.querySelector(".home_episodes-screen_content");
    var wait = 0;
    if (overlay) {
      overlay.classList.add("is-leaving");
      var raw = (window.getComputedStyle(overlay).transitionDuration || "0s")
        .split(",")[0]
        .trim();
      var n = parseFloat(raw);
      if (isFinite(n) && n >= 0) {
        wait = raw.indexOf("ms") !== -1 ? n : n * 1000;
      }
    }
    $(`body`).removeClass(`${home_episodes.id}`);
    setTimeout(() => {
      $(`body`).removeClass(`${home_episodes.id}`);
      $(`.${home_episodes.id}`).remove();
      main.state = home_episodes.previous;
    }, wait);
  },

  // Highlight (.selected) moves with Up and Down. The loaded season
  // (.active) stays put until Enter or Right, so those two indexes diverge.
  readFocus: function () {
    var columns = $(
      `.${home_episodes.id}.${home_episodes.id}_content .option`
    );
    var column = columns.index(columns.filter(".active"));
    if (column < 0) column = 0;
    var seasons = $(`.seasons-list .season`);
    var season = seasons.index(seasons.filter(".selected"));
    if (season < 0) season = 0;
    var loaded = seasons.index(seasons.filter(".active"));
    var episodes = home_episodes.data.episodes;
    var episodeCount =
      episodes && episodes.length ? episodes.length : 0;
    var list = $(".episodes .episodes-list")[0];
    var episode = list && list.slick ? list.slick.currentSlide : 0;
    if (episodeCount && episode >= episodeCount) episode = episodeCount - 1;
    if (episode < 0) episode = 0;
    return {
      column: column,
      season: season,
      seasonCount: seasons.length,
      loaded: loaded,
      episode: episode,
      episodeCount: episodeCount,
    };
  },

  // column 0 is the season list, column 1 is that season's episodes.
  stepFocus: function (state, direction) {
    var next = {
      column: state.column,
      season: state.season,
      seasonCount: state.seasonCount,
      loaded: state.loaded,
      episode: state.episode,
      episodeCount: state.episodeCount,
    };
    var lastSeason = state.seasonCount - 1;
    var lastEpisode = state.episodeCount - 1;
    if (direction === "left") {
      if (next.column > 0) next.column = 0;
    } else if (direction === "right") {
      if (next.column === 0 && state.seasonCount > 0) {
        next.column = 1;
        if (next.loaded !== next.season) {
          next.loaded = next.season;
          next.episode = 0;
        }
      }
    } else if (direction === "up") {
      if (next.column === 0) {
        if (next.season > 0) next.season -= 1;
      } else if (next.episode > 0) {
        next.episode -= 1;
      }
    } else if (direction === "down") {
      if (next.column === 0) {
        if (next.season < lastSeason) next.season += 1;
      } else if (next.episode < lastEpisode) {
        next.episode += 1;
      }
    }
    return next;
  },

  scrollSeasons: function (index) {
    var count = $(`.seasons-list .season`).length;
    var marginTop = 0;
    if (count > 8 && index > 4) {
      if (index > count - 4) {
        marginTop = -((count - 8) * 72);
      } else {
        marginTop = -((index - 4) * 72);
      }
    }
    var track = document.getElementById("seasons-list-offset");
    if (track) track.style.marginTop = marginTop + "px";
  },

  applyFocus: function (prev, next) {
    var columns = $(
      `.${home_episodes.id}.${home_episodes.id}_content .option`
    );
    columns.removeClass("active");
    if (columns.length) {
      var column = next.column;
      if (column < 0) column = 0;
      if (column > columns.length - 1) column = columns.length - 1;
      columns.eq(column).addClass("active");
    }
    var seasons = $(`.seasons-list .season`);
    if (seasons.length) {
      seasons.removeClass("selected");
      seasons.eq(next.season).addClass("selected");
    }
    if (next.season !== prev.season) {
      home_episodes.scrollSeasons(next.season);
    }
    if (next.loaded !== prev.loaded && next.loaded >= 0) {
      seasons.removeClass("active");
      seasons.eq(next.loaded).addClass("active");
      var seasonData = home_episodes.data.seasons;
      if (seasonData && seasonData[next.loaded]) {
        home_episodes.load(seasonData[next.loaded]);
      }
    } else if (next.column > 0) {
      var list = $(".episodes .episodes-list")[0];
      if (list && list.slick && list.slick.currentSlide !== next.episode) {
        list.slick.slickGoTo(next.episode);
      }
    }
  },

  keyDown: function (event) {
    var direction = null;
    switch (event.keyCode) {
      case tvKey.IS_KEY_BACK(event.keyCode):
        home_episodes.destroy();
        return;
      case tvKey.KEY_LEFT:
        direction = "left";
        break;
      case tvKey.KEY_RIGHT:
        direction = "right";
        break;
      case tvKey.KEY_UP:
        direction = "up";
        break;
      case tvKey.KEY_DOWN:
        direction = "down";
        break;
      case tvKey.KEY_ENTER:
      case tvKey.KEY_PANEL_ENTER:
        var focus = home_episodes.readFocus();
        if (focus.column > 0) {
          var episode = (home_episodes.data.episodes || [])[focus.episode];
          if (episode) video.init(episode);
        } else if (
          home_episodes.data.seasons &&
          home_episodes.data.seasons[focus.season]
        ) {
          var seasons = $(`.seasons-list .season`);
          seasons.removeClass("active");
          seasons.eq(focus.season).addClass("active");
          home_episodes.load(home_episodes.data.seasons[focus.season]);
        }
        return;
    }
    if (!direction) return;
    var prev = home_episodes.readFocus();
    home_episodes.applyFocus(prev, home_episodes.stepFocus(prev, direction));
  },
};
