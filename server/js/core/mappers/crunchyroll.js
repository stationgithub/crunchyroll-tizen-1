window.mapper = {
  loaded: 0,
  loadedSubcategories: 0,

  // episode_count and is_simulcast live on the series payload we already
  // fetched. A missing field stays missing so the hero can omit that piece.
  seriesFacts: function (panel) {
    var facts = {};
    var meta = panel && panel.series_metadata;
    if (!meta) {
      return facts;
    }
    var count = meta.episode_count;
    if (typeof count === "string" && /^[0-9]+$/.test(count)) {
      count = Number(count);
    }
    if (typeof count === "number" && isFinite(count) && count > 0) {
      facts.episodeCount = count;
    }
    if (meta.is_simulcast === true) {
      facts.status = "STREAMING";
    } else if (meta.is_simulcast === false) {
      facts.status = "COMPLETE";
    }
    return facts;
  },

  home: function (response, callback) {
    var lists = response.data.filter((element) =>
      [
        "recommendations",
        "history",
        "browse",
        "series",
        "because_you_watched",
      ].includes(element.response_type)
    );

    var banner = response.data.find((p) => p.resource_type === "panel");
    var panel = banner.panel;
    var facts = mapper.seriesFacts(panel);
    var bannerItem = {
      id: panel.id,
      title: panel.title,
      description: panel.description,
      type: panel.type,
      background: mapper.preventImageErrorTest(function () {
        return (
          mapper.wideStill(panel.images) ||
          panel.images.poster_wide[0][4].source
        );
      }, panel.id),
    };
    if (facts.episodeCount) {
      bannerItem.episodeCount = facts.episodeCount;
    }
    if (facts.status) {
      bannerItem.status = facts.status;
    }

    home.data.main = {
      banner: bannerItem,
      lists: lists.map((list) => ({
        title: list.title,
        responseType: list.response_type,
        items: [],
      })),
    };

    var finish = function () {
      home.data.main.lists = home.data.main.lists.filter(
        (e) => e.items.length > 0
      );
      // The saved watched list is enough to sink rows. Live history is up to
      // 15 pages and used to hold the first paint.
      try {
        if (window.localShelves) {
          localShelves.appendToHome(null);
        }
      } catch (error) {
        console.log("local shelves skipped");
      }
      callback.success();
    };

    if (!lists.length) {
      finish();
      return;
    }

    mapper.loaded = 0;
    var settle = function (items, on) {
      home.data.main.lists[on].items = items || [];
      mapper.loaded++;
      if (mapper.loaded === lists.length) {
        finish();
      }
    };
    for (var index = 0; index < lists.length; index++) {
      mapper.load(lists[index], index, {
        success: function (test, on) {
          var items = [];
          try {
            items = mapper.mapItems(test && test.data) || [];
          } catch (error) {
            console.log(error);
          }
          settle(items, on);
        },
        error: function (error, on) {
          console.log(error);
          settle([], on);
        },
      });
    }
  },

  load: (item, index, callback) => {
    session.refresh({
      success: function (storage) {
        var url;
        if (item.resource_type === "dynamic_collection") {
          url = item.link;
        } else {
          url = `/content/v2/cms/objects/${item.ids.join()}?locale=${session.usableLanguage(
            storage.account && storage.account.language,
            "en-US"
          )}`;
        }

        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        return fetch(`${service.api.url}${url}`, { headers: headers })
          .then((response) => response.json())
          .then((json) => callback.success(json, index))
          .catch((error) => {
            console.log(error);
            callback.error && callback.error(error, index);
          });
      },
      error: function (error) {
        callback.error && callback.error(error, index);
      },
    });
  },

  continue: function (response) {
    var item = response.data[0];
    return {
      id: item.panel.id,
      stream: item.panel.streams_link.substr(
        item.panel.streams_link.indexOf("/videos/") + 8,
        9
      ),
      serie: item.panel.episode_metadata.series_title,
      episode: item.panel.title,
      season_number: item.panel.episode_metadata.season_number || 0,
      episode_number: item.panel.episode_metadata.episode_number || 0,
      description: item.panel.description,
      background: mapper.preventImageErrorTest(function () {
        return item.panel.images.thumbnail[0][4].source;
      }, item.panel.id),
      watched: !item.never_watched,
      fullyWatched: !!item.fully_watched,
      seriesId: item.panel.episode_metadata.series_id || "",
      // Up-next payload: `playhead` is seconds, `fully_watched` is a boolean,
      // duration is `episode_metadata.duration_ms`. Minute fields stay for shelves.
      playhead: Math.round(item.playhead / 60),
      playheadSeconds: Number(item.playhead) || 0,
      duration: Math.round(item.panel.episode_metadata.duration_ms / 60000),
      durationSeconds: (item.panel.episode_metadata.duration_ms || 0) / 1000,
      played:
        (item.playhead * 100) /
        (item.panel.episode_metadata.duration_ms / 1000),
    };
  },

  // The seasons feed lists one object per audio version. Those share a
  // version set, so they are one season. A different title or version set
  // stays as its own season.
  seasons: function (response) {
    var items = (response && response.items) || [];
    var groups = [];
    var indexByKey = {};
    items.forEach(function (season) {
      var key = mapper.seasonKey(season);
      if (indexByKey[key] == null) {
        indexByKey[key] = groups.length;
        groups.push([]);
      }
      groups[indexByKey[key]].push(season);
    });
    var preferred =
      (session.storage &&
        session.storage.account &&
        session.storage.account.audio) ||
      "";
    return groups.map(function (group) {
      var chosen = mapper.pickSeasonVersion(group, preferred);
      return {
        id: chosen.id,
        title: chosen.title,
        number: chosen.season_number,
      };
    });
  },

  seasonKey: function (season) {
    var versions = season.versions || [];
    var original = versions.filter(function (version) {
      return version.original && version.guid;
    })[0];
    if (original) {
      return "original:" + original.guid;
    }
    var guids = versions
      .map(function (version) {
        return version.guid;
      })
      .filter(Boolean)
      .sort();
    if (guids.length) {
      return "versions:" + guids.join(",");
    }
    return (
      "listed:" +
      (season.season_number == null ? "" : season.season_number) +
      "\0" +
      (season.title || "")
    );
  },

  pickSeasonVersion: function (group, preferred) {
    preferred = (preferred || "").toLowerCase();
    var lang = preferred.split("-")[0];
    var exact = null;
    var prefix = null;
    var original = null;
    group.forEach(function (season) {
      var candidates = [
        {
          audio_locale:
            season.audio_locale ||
            (season.audio_locales && season.audio_locales[0]),
          guid: season.id,
        },
      ].concat(season.versions || []);
      candidates.forEach(function (version) {
        if (!version.guid) {
          return;
        }
        var locale = (version.audio_locale || "").toLowerCase();
        if (version.original && !original) {
          original = {
            id: version.guid,
            title: season.title,
            season_number: season.season_number,
          };
        }
        if (!locale) {
          return;
        }
        var chosen = {
          id: version.guid,
          title: season.title,
          season_number: season.season_number,
        };
        if (preferred && locale === preferred && !exact) {
          exact = chosen;
        } else if (
          lang &&
          locale.split("-")[0] === lang &&
          !prefix
        ) {
          prefix = chosen;
        }
      });
    });
    if (exact) {
      return exact;
    }
    if (prefix) {
      return prefix;
    }
    if (original) {
      return original;
    }
    return {
      id: group[0].id,
      title: group[0].title,
      season_number: group[0].season_number,
    };
  },

  episodes: function (response, callback) {
    var source = (response && response.items) || [];
    if (!source.length) {
      callback && callback([]);
      return;
    }
    var episodes = source.map((episode) => ({
      id: episode.id,
      title: episode.title,
      episode: episode.title,
      serie: episode.series_title,
      description: episode.description,
      episode_number: episode.episode_number || 0,
      season_number: episode.season_number || 0,
      seriesId: episode.series_id || "",
      background: mapper.preventImageErrorTest(function () {
        return episode.images.thumbnail
          ? episode.images.thumbnail[0][1].source
          : "";
      }, episode.id),
      stream: episode.__links__.streams
        ? episode.__links__.streams.href.substr(
            episode.__links__.streams.href.indexOf("/videos/") + 8,
            9
          )
        : undefined,
      duration: Math.round(episode.duration_ms / 60000),
      durationSeconds: (episode.duration_ms || 0) / 1000,
      premium: episode.is_premium_only,
    }));

    mapper.playheads(episodes, function (playheads) {
      episodes = episodes.map((e) => {
        var element = playheads.get(e.id);
        // Playheads payload: `playhead` is seconds, `fully_watched` is a boolean.
        e.fullyWatched = !!(element && element.fully_watched);
        e.playheadSeconds =
          element && isFinite(Number(element.playhead))
            ? Number(element.playhead)
            : 0;
        e.playhead = element
          ? element.fully_watched
            ? e.duration
            : Math.round(element.playhead / 60)
          : 0;
        e.playedAt = 0;
        if (element) {
          var stamp =
            element.last_modified ||
            element.modified_at ||
            element.date_played ||
            "";
          var parsed = stamp ? Date.parse(stamp) : NaN;
          e.playedAt = isFinite(parsed) ? parsed : 0;
        }
        return e;
      });
      callback && callback(episodes);
    });
  },

  // A finished episode keeps the orange pill. A few seconds left still
  // counts as finished, matching the end-of-episode window.
  watchFinished: function (item) {
    if (!item) {
      return false;
    }
    if (item.fullyWatched || item.fully_watched) {
      return true;
    }
    var durationSeconds = Number(item.durationSeconds);
    var playheadSeconds = Number(item.playheadSeconds);
    if (
      isFinite(durationSeconds) &&
      durationSeconds > 0 &&
      isFinite(playheadSeconds) &&
      durationSeconds - playheadSeconds <= 10
    ) {
      return true;
    }
    var duration = Number(item.duration);
    var playhead = Number(item.playhead);
    return (
      isFinite(duration) &&
      duration > 0 &&
      isFinite(playhead) &&
      playhead >= duration
    );
  },

  // Newest finished episode has no suffix. The three before it read -1, -2, -3.
  watchLabel: function (item, sequenceIndex) {
    if (!mapper.watchFinished(item)) {
      var left = (Number(item.duration) || 0) - (Number(item.playhead) || 0);
      if (!isFinite(left) || left < 0) {
        left = 0;
      }
      return left + "m";
    }
    var text = translate.go("home.episodes.watched");
    var marks = ["", " -1", " -2", " -3"];
    if (sequenceIndex >= 0 && sequenceIndex < marks.length) {
      return text + marks[sequenceIndex];
    }
    return text;
  },

  stampWatchSequence: function (items) {
    var sequence = 0;
    (items || []).forEach(function (item) {
      if (!item) {
        return;
      }
      var episode = item.display === "episode" || item.type === "episode" || item.episodeId;
      if (!episode || !mapper.watchFinished(item)) {
        item.watchSequence = -1;
        return;
      }
      item.watchSequence = sequence < 4 ? sequence : -1;
      sequence += 1;
    });
    return items;
  },

  progressPill: function (item, sequenceIndex) {
    if (!item) {
      return "";
    }
    var finished = mapper.watchFinished(item);
    if (!finished && !(Number(item.playhead) > 0 && Number(item.duration) > 0)) {
      return "";
    }
    var seq = sequenceIndex;
    if (seq == null) {
      seq = item.watchSequence;
    }
    var width = finished
      ? 100
      : (Number(item.playhead) * 100) / Number(item.duration);
    var label = mapper.watchLabel(item, seq);
    var safe = String(label)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
    return (
      '<div class="progress' +
      (finished ? " watched" : "") +
      '" style="width: ' +
      width +
      '%" value="' +
      safe +
      '"></div>'
    );
  },

  playheads: function (episodes, callback) {
    service.playheads({
      data: {
        ids: episodes.map((e) => e.id).join(),
      },
      success: function (response) {
        var rows = (response && response.data) || [];
        var playheads = new Map(
          rows.map((obj) => [obj.content_id, obj])
        );
        callback && callback(playheads);
      },
      error: function (error) {
        console.log(error);
        callback && callback(new Map());
      },
    });
  },

  search: function (response) {
    return response.data.reduce(
      (acum, elem) =>
        elem.type === "series" || elem.type === "movie_listing"
          ? [
              ...acum,
              ...elem.items.map(function (item) {
                var meta = item.series_metadata || item.movie_listing_metadata || {};
                var average = item.rating && Number(item.rating.average);
                return {
                  display: "serie",
                  type: item.type,
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  background: mapper.preventImageErrorTest(function () {
                    return item.images.poster_wide[0][5].source;
                  }, item.id),
                  poster: mapper.preventImageErrorTest(function () {
                    return item.images.poster_tall[0][2].source;
                  }, item.id),
                  categories: meta.tenant_categories || [],
                  year: Number(meta.series_launch_year) || 0,
                  rating: isFinite(average) && average > 0 ? average : null,
                  dubbed: typeof meta.is_dubbed === "boolean" ? meta.is_dubbed : null,
                  subbed: typeof meta.is_subbed === "boolean" ? meta.is_subbed : null,
                  source: "cr",
                };
              }),
            ]
          : acum,
      []
    );
  },

  history: function (response) {
    var seen = {};
    var items = [];
    (response.data || []).forEach(function (element) {
      if (!element.panel || !element.panel.episode_metadata) {
        return;
      }
      var meta = element.panel.episode_metadata;
      var episodeId = element.panel.id || element.id;
      // Watch history is one row per session. A partial rewatch of the same
      // episode comes back again. Keep the newest row for that episode.
      if (!episodeId || seen[episodeId]) {
        return;
      }
      seen[episodeId] = true;
      var season = meta.season_number || 0;
      var episodeNumber = meta.episode_number || 0;
      items.push({
        id: meta.series_id,
        episodeId: episodeId,
        seriesId: meta.series_id || "",
        serie: meta.series_title || element.title || "",
        episode: element.panel.title || "",
        season_number: season,
        episode_number: episodeNumber,
        fullyWatched: !!element.fully_watched,
        playheadSeconds: Number(element.playhead) || 0,
        durationSeconds: (meta.duration_ms || 0) / 1000,
        mark: episodeNumber
          ? season
            ? "S" + season + " E" + episodeNumber
            : "E" + episodeNumber
          : "",
        playhead: element.playhead ? Math.round(element.playhead / 60) : 0,
        duration: Math.round((meta.duration_ms || 0) / 60000),
        title: meta.series_title || element.title,
        description: element.panel.title,
        background: mapper.preventImageErrorTest(function () {
          return element.panel.images.thumbnail[0][4].source;
        }, meta.series_id),
      });
    });
    return items;
  },

  preventImageErrorTest: function (callback, id) {
    try {
      return callback();
    } catch (error) {
      console.log(`error image #${id}`);
      return `https://dummyimage.com/600x400/f48321/fff.png&text=IMAGE+${id}`;
    }
  },

  listByCategories: function (id, subcategories, callback) {
    home.data.main = {
      category: subcategories[0].parent_category,
      banner: {
        id: "",
        title: "",
        description: "",
        background: "",
      },
      lists: subcategories.map((subcategory) => ({
        lazy: true,
        id: subcategory.tenant_category,
        title: subcategory.localization.description,
        items: [],
      })),
    };

    mapper.loadedSubcategories = 0;
    for (var index = 0; index < subcategories.length; index++) {
      mapper.loadCategoryListAsync(
        `${id},${subcategories[index].tenant_category}`,
        0,
        20,
        index,
        {
          success: function (response, listPosition) {
            home.data.main.lists[listPosition].items = mapper.mapItems(
              response.items
            );
            if (window.localShelves && localShelves.sinkWatched) {
              home.data.main.lists[listPosition].items = localShelves.sinkWatched(
                home.data.main.lists[listPosition].items,
                localShelves.currentWatched()
              );
            }
            mapper.loadedSubcategories++;
            if (mapper.loadedSubcategories === subcategories.length) {
              home.data.main.lists = home.data.main.lists.filter(
                (e) => e.items.length > 0
              );
              home.data.main.banner =
                home.data.main.lists[listPosition].items[0];
              callback.success();
            }
          },
          error: function (error) {
            console.log("fail on load subcategorie list.", error);
          },
        }
      );
    }
  },

  // Largest wide still already in the payload. The hero used poster_wide[0][4].
  // A bigger rendition in poster_wide or the wide background list replaces it.
  // Missing sizes stay on that same URL. Nothing here scales a small file up.
  wideStill: function (images) {
    var current = "";
    try {
      current =
        (images.poster_wide[0][4] && images.poster_wide[0][4].source) || "";
    } catch (error) {
      current = "";
    }
    var best = null;
    var bestWidth = -1;
    var consider = function (rendition) {
      if (!rendition || !rendition.source) {
        return;
      }
      var width = Number(rendition.width);
      if (!isFinite(width) || width <= 0) {
        return;
      }
      var height = Number(rendition.height);
      var area = width * (isFinite(height) && height > 0 ? height : 1);
      if (!best || width > bestWidth || (width === bestWidth && area > best.area)) {
        bestWidth = width;
        best = { source: rendition.source, area: area };
      }
    };
    var walk = function (node) {
      if (!node) {
        return;
      }
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) {
          walk(node[i]);
        }
        return;
      }
      if (node.source) {
        consider(node);
      }
    };
    if (images) {
      walk(images.poster_wide);
      walk(images.background);
    }
    if (best && best.source) {
      return best.source;
    }
    return current;
  },

  mapItems: function (items) {
    if (!Array.isArray(items)) {
      return [];
    }
    var mapped = [];
    items.forEach(function (item) {
      try {
        var one = mapper.mapItem(item);
        if (one) {
          mapped.push(one);
        }
      } catch (error) {
        console.log("CRITICAL: error on map element.");
      }
    });
    return mapped;
  },

  mapItem: function (item) {
    if (!item) {
      return null;
    }
    var rawPlayhead = item && item.playhead;
    var playheadSeconds = Number(rawPlayhead);
    if (!isFinite(playheadSeconds)) {
      playheadSeconds = undefined;
    }
    var fullyWatched = !!(item && item.fully_watched);
    var playhead = rawPlayhead
      ? Math.round(Number(rawPlayhead) / 60)
      : undefined;
    item = item.panel ? item.panel : item;
    if (item && item.fully_watched) {
      fullyWatched = true;
    }
    var facts = mapper.seriesFacts(item);
    var id = item.id;
    var display = "serie";
    var title = item.title;

    var episodeId = "";
    var durationSeconds;
    var seasonNumber;
    var episodeNumber;
    var episodeTitle = "";
    var serieTitle = "";
    if (item.type === "episode") {
      episodeId = item.id;
      id = item.episode_metadata.series_id;
      var duration = Math.round(item.episode_metadata.duration_ms / 60000);
      durationSeconds = (item.episode_metadata.duration_ms || 0) / 1000;
      seasonNumber = item.episode_metadata.season_number || 0;
      episodeNumber = item.episode_metadata.episode_number || 0;
      episodeTitle = item.title || "";
      serieTitle = item.episode_metadata.series_title || "";
      display = "episode";
      title = item.episode_metadata.series_title;
      var background = item.images.thumbnail[0][4].source;
      var poster = undefined;
      var categories = item.episode_metadata.tenant_categories;
    } else if (item.type == "movie") {
      var duration = Math.round(item.movie_metadata.duration_ms / 60000);
      display = "episode";
      var background = item.images.thumbnail[0][4].source;
      var poster = undefined;
      var categories = item.movie_metadata.tenant_categories ? item.movie_metadata.tenant_categories : [];
    } else {
      var background =
        mapper.wideStill(item.images) ||
        item.images.poster_wide[0][4].source;
      var poster = item.images.poster_tall[0][2].source;
    }

    var mapped = {
      id,
      display,
      duration,
      playhead,
      background,
      poster,
      title,
      description: item.description,
      type: item.type,
      categories: categories,
    };
    if (episodeId) {
      mapped.episodeId = episodeId;
      mapped.seriesId = id;
      mapped.serie = serieTitle;
      mapped.episode = episodeTitle;
      mapped.season_number = seasonNumber || 0;
      mapped.episode_number = episodeNumber || 0;
      mapped.fullyWatched = fullyWatched;
      if (isFinite(playheadSeconds)) {
        mapped.playheadSeconds = playheadSeconds;
      }
      if (isFinite(durationSeconds) && durationSeconds > 0) {
        mapped.durationSeconds = durationSeconds;
      }
    }
    if (facts.episodeCount) {
      mapped.episodeCount = facts.episodeCount;
    }
    if (facts.status) {
      mapped.status = facts.status;
    }
    return mapped;
  },

  loadCategoryListAsync: function (categories, offset, size, index, callback) {
    session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        return fetch(
          `${service.api.url}/content/v1/browse?categories=${categories}&n=${size}&start=${offset}`,
          { headers: headers }
        )
          .then((response) => response.json())
          .then((json) => callback.success(json, index))
          .catch((error) => {
            callback.error(error);
          });
      },
    });
  },
};
