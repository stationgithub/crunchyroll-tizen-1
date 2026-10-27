window.localShelves = {
  readJson: function (path) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", path, false);
      xhr.send(null);
      if (!xhr.responseText) {
        return null;
      }
      if (xhr.status !== 200 && xhr.status !== 0) {
        return null;
      }
      return JSON.parse(xhr.responseText);
    } catch (error) {
      console.log("local shelf unreadable " + path);
      return null;
    }
  },

  watchedIdSet: function () {
    var data = this.readJson("server/data/watched-cr-ids.json");
    if (!data) {
      return null;
    }
    var list = Array.isArray(data) ? data : data.ids;
    if (!Array.isArray(list)) {
      return null;
    }
    var set = {};
    list.forEach(function (id) {
      if (id) {
        set[String(id)] = true;
      }
    });
    return set;
  },

  // Series the saved list already marks as started or finished.
  // Planning entries stay off this list.
  knownWatchedIds: function () {
    var set = this.watchedIdSet() || {};
    var data = this.readJson("server/data/watched-cr-ids.json");
    var map = data && data.map;
    if (!map) {
      return set;
    }
    Object.keys(map).forEach(function (key) {
      var entry = map[key];
      if (!entry || !entry.crId || entry.status === "PLANNING") {
        return;
      }
      if (!entry.status && !(Number(entry.progress) > 0)) {
        return;
      }
      set[String(entry.crId)] = true;
    });
    return set;
  },

  currentWatched: function () {
    return this.watchedSeries || this.knownWatchedIds();
  },

  finishedItem: function (item, completed) {
    if (!item) {
      return false;
    }
    if (item.fullyWatched) {
      return true;
    }
    if (item.display === "episode" || item.type === "episode") {
      return false;
    }
    var id = item.seriesId || item.id;
    return !!(completed && id && completed[String(id)]);
  },

  // Unwatched stays in its original order. Finished titles follow it.
  sinkWatched: function (items, completed) {
    var fresh = [];
    var done = [];
    (items || []).forEach(function (item) {
      if (this.finishedItem(item, completed)) {
        done.push(item);
      } else {
        fresh.push(item);
      }
    }, this);
    if (window.mapper && mapper.stampWatchSequence) {
      mapper.stampWatchSequence(items);
    }
    return fresh.concat(done);
  },

  // NEET, Top Picks, favorites, then Continue Watching. Everything else
  // keeps the order it already had.
  orderHome: function (lists) {
    var ranked = (lists || []).map(function (row, index) {
      var title = String((row && row.title) || "").toLowerCase();
      var type = String((row && row.responseType) || "");
      var rank = 4;
      if (title.indexOf("neet") !== -1) {
        rank = 0;
      } else if (title.indexOf("top pick") !== -1) {
        rank = 1;
      } else if (title.indexOf("fav") !== -1) {
        rank = 2;
      } else if (title.indexOf("continue") !== -1 || type === "history") {
        rank = 3;
      }
      return { row: row, rank: rank, index: index };
    });
    var hasTop = ranked.some(function (entry) {
      return entry.rank === 1;
    });
    if (!hasTop) {
      ranked.some(function (entry) {
        if (String((entry.row && entry.row.responseType) || "") === "recommendations") {
          entry.rank = 1;
          return true;
        }
        return false;
      });
    }
    ranked.sort(function (a, b) {
      return a.rank - b.rank || a.index - b.index;
    });
    return ranked.map(function (entry) {
      return entry.row;
    });
  },

  unseenItems: function (items, watched) {
    return (items || []).filter(function (item) {
      if (!item || !item.id) {
        return false;
      }
      if (watched && watched[String(item.id)]) {
        return false;
      }
      return true;
    });
  },

  withIds: function (items) {
    return (Array.isArray(items) ? items : []).filter(function (item) {
      return item && item.id;
    });
  },

  rows: function () {
    var rows = [];
    var tags = this.readJson("server/data/anilist-tags.json");
    var tagRows = tags && Array.isArray(tags.rows) ? tags.rows : [];
    var self = this;
    tagRows.forEach(function (row) {
      if (!row || !Array.isArray(row.items) || !row.items.length) {
        return;
      }
      var items = self.withIds(row.items);
      if (!items.length) {
        return;
      }
      rows.push({
        title: row.title,
        items: items,
      });
    });
    // Watched series stay in every row and are moved to the end later.
    var neet = this.readJson("server/data/neet-recommendations.json");
    if (neet && Array.isArray(neet.items) && neet.items.length) {
      var neetItems = self.withIds(neet.items);
      if (neetItems.length) {
        rows.push({
          title: neet.title || "NEET recommendations",
          items: neetItems,
          lead: true,
        });
      }
    }
    var favorites = this.readJson("server/data/your-favorites.json");
    if (favorites && Array.isArray(favorites.items) && favorites.items.length) {
      var favoriteItems = self.withIds(favorites.items);
      if (favoriteItems.length) {
        rows.push({
          title: favorites.title || "Your favorites",
          items: favoriteItems,
          lead: true,
        });
      }
    }
    return rows;
  },

  appendToHome: function (extra) {
    if (!window.home || !home.data || !home.data.main || !home.data.main.lists) {
      return;
    }
    var lists = home.data.main.lists;
    var watched = this.knownWatchedIds();
    if (extra) {
      Object.keys(extra).forEach(function (id) {
        if (id) {
          watched[String(id)] = true;
        }
      });
    }
    this.watchedSeries = watched;
    this.rows().forEach(function (row) {
      lists.push({
        title: row.title,
        items: row.items,
      });
    });
    lists.forEach(function (row) {
      var title = String((row && row.title) || "").toLowerCase();
      if (title.indexOf("fav") !== -1) {
        return;
      }
      row.items = localShelves.sinkWatched(row.items, watched);
    });
    home.data.main.lists = this.orderHome(lists);
  },
};
