window.search = {
  id: "search-screen",
  previous: NaN,
  input: NaN,
  position: -1,
  last_postion: 0,
  items_per_row: 6,
  pillColumns: 8,
  focusZone: "input",
  filterIndex: 0,
  pillIndex: 0,
  wheelIndex: 0,
  searched: false,
  blankQuery: false,
  requestId: 0,
  pool: null,
  audioAvailable: false,
  timer: 0,
  catalogCache: {},
  ratingCache: {},
  filters: {
    type: "all",
    audio: 0,
    tags: {},
    rating: 0,
    era: 0,
    length: 0,
  },
  ratings: [
    { label: "Any", floor: null },
    { label: "5.0", floor: 5 },
    { label: "4.9+", floor: 4.9 },
    { label: "4.8+", floor: 4.8 },
    { label: "4.7+", floor: 4.7 },
    { label: "4.6+", floor: 4.6 },
    { label: "4.5+", floor: 4.5 },
    { label: "4.0+", floor: 4 },
  ],
  audios: [
    { label: "Any", id: "all" },
    { label: "Dubbed", id: "dubbed" },
    { label: "Subbed", id: "subbed" },
  ],
  lengths: [
    { label: "Any", id: "any" },
    { label: "Series", id: "series" },
    { label: "Movies", id: "movies" },
    { label: "Shorts", id: "shorts" },
  ],
  eras: [],
  scroll_data: {
    item_padding: 16,
    item_height: 219,
    rows: 10,
  },
  data: {
    result: [],
  },

  init: function () {
    var search_element = document.createElement("div");
    search_element.id = search.id;
    search.focusZone = "input";
    search.filterIndex = 0;
    search.pillIndex = 0;
    search.wheelIndex = 0;
    search.wheelReturn = null;
    search.position = -1;
    search.searched = false;
    search.blankQuery = false;
    search.pool = null;
    search.audioAvailable = false;
    search.filters.type = "all";
    search.filters.audio = 0;
    search.filters.tags = {};
    search.filters.rating = 0;
    search.filters.era = 0;
    search.filters.length = 0;
    search.eras = search.buildEras();

    search_element.innerHTML = `
      <div class="content">
        <div class="mast">
          <div class="input focus" id="search-screen_input">
            <input type="text" tabindex="-1" placeholder="${translate.go('search.placeholder')}">
          </div>
          <div class="wheels" id="search-wheels"></div>
        </div>
        <div class="pills" id="search-pills"></div>
        <div class="empty" id="search-empty"></div>
        <div class="list-container">
          <div class="list-container-over" style="grid-template-columns: repeat(${search.items_per_row}, 1fr);"></div>
        </div>
        <div class="logo-fixed">
          <img src="server/img/logo-big.png"/>
        </div>
      </div>`;

    document.body.appendChild(search_element);
    search.input = document.getElementById(
      "search-screen_input"
    ).firstElementChild;
    search.paintChipStates();
    search.paintPills();
    search.paintWheels();
  },

  destroy: function () {
    clearTimeout(search.timer);
    search.requestId += 1;
    search.data.result = [];
    search.pool = null;
    search.searched = false;
    search.blankQuery = false;
    search.audioAvailable = false;
    search.filters.type = "all";
    search.filters.audio = 0;
    search.filters.tags = {};
    search.filters.rating = 0;
    search.filters.era = 0;
    search.filters.length = 0;
    search.focusZone = "input";
    search.position = -1;
    document.body.removeChild(document.getElementById(search.id));
  },

  buildEras: function () {
    var year = new Date().getFullYear();
    var values = [{ label: "Any", from: 0, to: 0 }];
    var recent;
    for (recent = year; recent >= year - 2; recent--) {
      values.push({ label: String(recent), from: recent, to: recent });
    }
    var decade = Math.floor(year / 10) * 10;
    var start;
    for (start = decade; start >= 1990; start -= 10) {
      values.push({
        label: String(start).slice(0, 3) + "0s",
        from: start,
        to: start + 9,
      });
    }
    return values;
  },

  pillDefs: function () {
    return [
      { id: "bl", label: "Yaoi (Boy's Love)", tag: "Boys' Love" },
      { id: "yuri", label: "Yuri (Girl's Love)", tag: "Yuri" },
      { id: "josei", label: "Josei (Women)", tag: "Josei" },
      { id: "iyashikei", label: "Iyashikei (Healing)", tag: "Iyashikei" },
      { id: "isekai", label: "Isekai", tag: "Isekai" },
      { id: "lgbtq", label: "LGBTQ+ Themes", tag: "LGBTQ+ Themes" },
      { id: "action", label: "Action", slug: "action", genre: "Action" },
      { id: "adventure", label: "Adventure", slug: "adventure", genre: "Adventure" },
      { id: "comedy", label: "Comedy", slug: "comedy", genre: "Comedy" },
      { id: "drama", label: "Drama", slug: "drama", genre: "Drama" },
      { id: "fantasy", label: "Fantasy", slug: "fantasy", genre: "Fantasy" },
      { id: "music", label: "Music", slug: "music", genre: "Music" },
      { id: "romance", label: "Romance", slug: "romance", genre: "Romance" },
      { id: "scifi", label: "Sci-Fi", slug: "sci-fi", genre: "Sci-Fi" },
      { id: "seinen", label: "Seinen (Men)", slug: "seinen", tag: "Seinen", match: "Seinen" },
      { id: "shojo", label: "Shojo (Girls)", slug: "shojo", tag: "Shoujo", match: "Shojo" },
      { id: "shonen", label: "Shonen (Boys)", slug: "shonen", tag: "Shounen", match: "Shonen" },
      { id: "slice", label: "Slice of Life", slug: "slice-of-life", genre: "Slice of Life" },
      { id: "sports", label: "Sports", slug: "sports", genre: "Sports" },
      { id: "supernatural", label: "Supernatural", slug: "supernatural", genre: "Supernatural" },
      { id: "thriller", label: "Thriller", slug: "thriller", genre: "Thriller" },
    ];
  },

  wheelDefs: function () {
    return [
      { name: "Rating", key: "rating", values: search.ratings },
      { name: "Era", key: "era", values: search.eras },
      { name: "Length", key: "length", values: search.lengths },
      { name: "Audio", key: "audio", values: search.audios },
    ];
  },

  selectedPills: function (kind) {
    return search.pillDefs().filter(function (pill) {
      if (!search.filters.tags[pill.id]) return false;
      if (kind === "cr") return !!pill.slug;
      if (kind === "extra") return !pill.slug;
      return true;
    });
  },

  currentEra: function () {
    var era = search.eras[search.filters.era];
    if (!era || !era.from) return null;
    return era;
  },

  ratingFloor: function () {
    var row = search.ratings[search.filters.rating];
    if (!row || row.floor == null) return null;
    return row.floor;
  },

  hasCatalogFilter: function () {
    var id;
    for (id in search.filters.tags) {
      if (search.filters.tags[id]) return true;
    }
    return search.filters.rating > 0 || search.filters.era > 0 || search.filters.length > 0 || search.filters.audio > 0;
  },

  audioChoice: function () {
    return search.audios[search.filters.audio] || search.audios[0];
  },

  lengthChoice: function () {
    return search.lengths[search.filters.length] || search.lengths[0];
  },

  typeParam: function () {
    var choice = search.lengthChoice();
    if (choice.id === "series") return "series";
    if (choice.id === "movies") return "movie_listing";
    return "series,movie_listing";
  },

  chips: function () {
    var nodes = document.querySelectorAll("#search-screen .chip");
    var visible = [];
    Array.prototype.forEach.call(nodes, function (chip) {
      var node = chip;
      while (node && node.id !== search.id) {
        if (
          node.hidden ||
          (node.hasAttribute && node.hasAttribute("hidden"))
        ) {
          return;
        }
        node = node.parentNode;
      }
      visible.push(chip);
    });
    return visible;
  },

  paintChipStates: function () {
    var chips = search.chips();
    if (search.filterIndex >= chips.length) {
      search.filterIndex = 0;
      chips.forEach(function (chip, index) {
        if (
          chip.getAttribute("data-group") === "type" &&
          chip.getAttribute("data-value") === search.filters.type
        ) {
          search.filterIndex = index;
        }
      });
    }
    var all = document.querySelectorAll("#search-screen .chip");
    Array.prototype.forEach.call(all, function (chip) {
      var group = chip.getAttribute("data-group");
      var value = chip.getAttribute("data-value");
      if (search.filters[group] === value) chip.classList.add("selected");
      else chip.classList.remove("selected");
      chip.classList.remove("focus");
    });
    if (search.focusZone === "filters" && chips[search.filterIndex]) {
      chips[search.filterIndex].classList.add("focus");
    }
  },

  paintPills: function () {
    var root = document.getElementById("search-pills");
    if (!root) return;
    root.innerHTML = "";
    search.pillDefs().forEach(function (pill, index) {
      var node = document.createElement("div");
      node.className = "pill";
      if (search.filters.tags[pill.id]) node.classList.add("on");
      if (search.focusZone === "pills" && index === search.pillIndex) {
        node.classList.add("focus");
      }
      node.textContent = pill.label;
      root.appendChild(node);
    });
  },

  paintWheels: function () {
    var root = document.getElementById("search-wheels");
    if (!root) return;
    root.innerHTML = "";
    search.wheelDefs().forEach(function (wheel, index) {
      var column = document.createElement("div");
      column.className = "wheel";
      if (search.focusZone === "wheels" && index === search.wheelIndex) {
        column.classList.add("focus");
      }
      var name = document.createElement("div");
      name.className = "wheel-name";
      name.textContent = wheel.name;
      column.appendChild(name);
      var current = search.filters[wheel.key] || 0;
      var chosen = wheel.values[current];
      if (chosen && chosen.label !== "Any") column.classList.add("on");
      [-1, 0, 1].forEach(function (offset) {
        var row = document.createElement("div");
        row.className = "wheel-row" + (offset === 0 ? " center" : "");
        var value = wheel.values[current + offset];
        row.textContent = value ? value.label : "";
        column.appendChild(row);
      });
      root.appendChild(column);
    });
  },

  zones: function () {
    var list = ["input"];
    if (search.chips().length) list.push("filters");
    list.push("pills", "wheels");
    if (search.data.result.length) list.push("results");
    return list;
  },

  moveZone: function (dir) {
    var zones = search.zones();
    var index = zones.indexOf(search.focusZone);
    var next = zones[index + dir];
    if (!next) return false;
    if (next === "input") search.focusInput();
    else if (next === "filters") search.focusFilters();
    else if (next === "pills") search.focusPills();
    else if (next === "wheels") search.focusWheels();
    else if (!search.enterResults()) return false;
    return true;
  },

  start: function () {
    clearTimeout(search.timer);
    var requestId = ++search.requestId;
    var query = search.input && search.input.value != null
      ? String(search.input.value).trim()
      : "";
    search.blankQuery = !query;
    if (!query && !search.hasCatalogFilter()) {
      loading.end();
      search.searched = false;
      search.pool = [];
      search.showCards([]);
      return;
    }
    loading.start();
    search.gather(query).then(function (cards) {
      if (requestId !== search.requestId) return;
      if (!document.getElementById(search.id)) return;
      loading.end();
      search.searched = true;
      search.ratingsPending = search.needsRatings(search.pool);
      search.showCards(cards);
      if (!search.ratingsPending) return;
      search.hydrateRatings(search.pool).then(function () {
        if (requestId !== search.requestId) return;
        if (!document.getElementById(search.id)) return;
        search.ratingsPending = false;
        search.showCards(search.localFilter(search.pool));
      });
    }).catch(function (error) {
      if (requestId !== search.requestId) return;
      loading.end();
      console.log(error);
      search.searched = true;
      search.pool = [];
      search.showCards([]);
    });
  },

  schedule: function () {
    clearTimeout(search.timer);
    search.timer = setTimeout(function () {
      search.start();
    }, 280);
  },

  gather: function (query) {
    return search.loadPool(query).then(function (cards) {
      return search.overlayLists(cards);
    }).then(function (cards) {
      search.pool = cards;
      return search.localFilter(cards);
    });
  },

  loadPool: function (query) {
    var era = search.currentEra();
    var genres = search.selectedPills("cr");
    if (query) {
      return search.promiseSearch(query).then(function (response) {
        return search.safeResults(response);
      });
    }
    // A single year uses Crunchyroll's season list. A tag pill, the watchlist,
    // or Shorts brings its own titles, then the genre and year checks run after.
    if (era && era.from === era.to) {
      return search.browseYear(era.from);
    }
    if (search.selectedPills("extra").length || search.lengthChoice().id === "shorts") {
      return Promise.resolve([]);
    }
    if (era && era.from !== era.to) {
      return search.anilistEra(era, genres);
    }
    if (genres.length) {
      return search.browseCategories(genres);
    }
    if (search.filters.rating > 0 || search.lengthChoice().id !== "any" || search.audioChoice().id !== "all") {
      return search.browsePopular();
    }
    return Promise.resolve([]);
  },

  promiseSearch: function (query) {
    return new Promise(function (resolve, reject) {
      service.search({
        data: {
          query: query,
          type: search.typeParam(),
        },
        success: function (response) {
          resolve(response);
        },
        error: reject,
      });
    });
  },

  promiseBrowse: function (data) {
    return new Promise(function (resolve, reject) {
      service.browse({
        data: data,
        success: function (response) {
          resolve(response || { data: [] });
        },
        error: reject,
      });
    });
  },

  browseCategories: function (genres) {
    var slugs = genres.map(function (pill) {
      return pill.slug;
    });
    return search.promiseBrowse({ categories: slugs.join(",") }).then(function (page) {
      return search.mapPanels(page);
    }).catch(function (error) {
      console.log(error);
      return [];
    });
  },

  browsePopular: function () {
    return search.promiseBrowse({}).then(function (page) {
      return search.mapPanels(page);
    }).catch(function (error) {
      console.log(error);
      return [];
    });
  },

  browseYear: function (year) {
    var seasons = ["winter", "spring", "summer", "fall"];
    return Promise.all(seasons.map(function (season) {
      return search.promiseBrowse({ seasonalTag: season + "-" + year }).catch(function () {
        return { data: [] };
      });
    })).then(function (pages) {
      var seen = {};
      var cards = [];
      pages.forEach(function (page) {
        search.mapPanels(page).forEach(function (card) {
          if (!card || seen[card.id]) return;
          seen[card.id] = true;
          cards.push(card);
        });
      });
      return cards;
    });
  },

  mapPanels: function (page) {
    var cards = [];
    ((page && page.data) || []).forEach(function (item) {
      var card = search.mapPanel(item);
      if (card) cards.push(card);
    });
    return cards;
  },

  mapPanel: function (item) {
    if (!item || !item.id || !item.title) return null;
    var meta = item.series_metadata || item.movie_listing_metadata || {};
    var average = item.rating && Number(item.rating.average);
    return {
      display: "serie",
      type: item.type || "series",
      id: item.id,
      title: item.title,
      description: item.description || "",
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
  },

  safeResults: function (response) {
    var groups = response && Array.isArray(response.data) ? response.data : [];
    var safe = {
      data: groups.map(function (group) {
        if (!group || typeof group !== "object") {
          return { type: "", items: [] };
        }
        var items = Array.isArray(group.items)
          ? group.items.filter(function (item) {
              return item && typeof item === "object";
            })
          : [];
        return { type: group.type, items: items };
      }),
    };
    try {
      return mapper.search(safe) || [];
    } catch (error) {
      console.log(error);
      return [];
    }
  },

  anilist: function (query, variables) {
    return fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: query, variables: variables || {} }),
    }).then(function (response) {
      if (!response.ok) throw new Error("anilist");
      return response.json();
    }).then(function (json) {
      if (json.errors) throw new Error("anilist");
      return json.data;
    });
  },

  mediaFields: function () {
    return "id title { romaji english } description coverImage { large } bannerImage startDate { year } genres tags { name } externalLinks { url }";
  },

  crunchyrollId: function (links) {
    var i;
    var text;
    var wrapped;
    var match;
    for (i = 0; i < (links || []).length; i++) {
      text = links[i] && links[i].url ? String(links[i].url) : "";
      if (!text) continue;
      wrapped = text.match(/[?&]url=([^&]+)/);
      if (wrapped) {
        try {
          text = decodeURIComponent(wrapped[1]);
        } catch (error) {}
      }
      if (!/crunchyroll\.com/i.test(text)) continue;
      match = text.match(/\/series\/([A-Za-z0-9]+)/);
      if (match) return match[1];
    }
    return "";
  },

  cardFromMedia: function (media) {
    if (!media) return null;
    var id = search.crunchyrollId(media.externalLinks);
    if (!id) return null;
    var title = (media.title && (media.title.english || media.title.romaji)) || "";
    if (!title) return null;
    var poster = (media.coverImage && media.coverImage.large) || "";
    var alias = { Shounen: "Shonen", Shoujo: "Shojo" };
    var names = (media.genres || []).slice();
    (media.tags || []).forEach(function (tag) {
      var name = tag && tag.name;
      if (!name) return;
      names.push(alias[name] || name);
    });
    return {
      display: "serie",
      type: "series",
      id: id,
      title: title,
      description: String(media.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      background: media.bannerImage || poster,
      poster: poster,
      categories: names,
      year: media.startDate && Number(media.startDate.year) || 0,
      rating: null,
      dubbed: null,
      subbed: null,
      source: "anilist",
    };
  },

  loadMedia: function (key, query, variablesForPage) {
    if (search.catalogCache[key]) {
      return Promise.resolve(search.catalogCache[key]);
    }
    var page = 1;
    var cards = [];
    var seen = {};
    function step() {
      return search.anilist(query, variablesForPage(page)).then(function (data) {
        var block = data && data.Page;
        var media = (block && block.media) || [];
        media.forEach(function (item) {
          var card = search.cardFromMedia(item);
          if (!card || seen[card.id]) return;
          seen[card.id] = true;
          cards.push(card);
        });
        search.catalogCache[key] = cards;
        return cards;
      });
    }
    return step().catch(function (error) {
      console.log(error);
      return [];
    });
  },

  loadTag: function (tag, era) {
    var from = era ? era.from : 0;
    var to = era ? era.to : 0;
    var fields = search.mediaFields();
    var query = from
      ? "query ($page: Int, $from: FuzzyDateInt, $to: FuzzyDateInt, $tag: String) { Page(page: $page, perPage: 50) { pageInfo { hasNextPage } media(type: ANIME, tag: $tag, startDate_greater: $from, startDate_lesser: $to, sort: POPULARITY_DESC) { " + fields + " } } }"
      : "query ($page: Int, $tag: String) { Page(page: $page, perPage: 50) { pageInfo { hasNextPage } media(type: ANIME, tag: $tag, sort: POPULARITY_DESC) { " + fields + " } } }";
    return search.loadMedia("tag:" + tag + ":" + from + ":" + to, query, function (page) {
      var variables = { page: page, tag: tag };
      if (from) {
        variables.from = from * 10000;
        variables.to = to * 10000 + 1231;
      }
      return variables;
    });
  },

  loadShorts: function (era) {
    var from = era ? era.from : 0;
    var to = era ? era.to : 0;
    var fields = search.mediaFields();
    var query = from
      ? "query ($page: Int, $from: FuzzyDateInt, $to: FuzzyDateInt) { Page(page: $page, perPage: 50) { pageInfo { hasNextPage } media(type: ANIME, duration_lesser: 15, format_in: [TV, TV_SHORT, ONA], startDate_greater: $from, startDate_lesser: $to, sort: POPULARITY_DESC) { " + fields + " } } }"
      : "query ($page: Int) { Page(page: $page, perPage: 50) { pageInfo { hasNextPage } media(type: ANIME, duration_lesser: 15, format_in: [TV, TV_SHORT, ONA], sort: POPULARITY_DESC) { " + fields + " } } }";
    return search.loadMedia("shorts:" + from + ":" + to, query, function (page) {
      var variables = { page: page };
      if (from) {
        variables.from = from * 10000;
        variables.to = to * 10000 + 1231;
      }
      return variables;
    });
  },

  anilistEra: function (era, genres) {
    var fields = search.mediaFields();
    var from = era.from * 10000;
    var to = era.to * 10000 + 1231;
    if (!genres.length) {
      var open = "query ($page: Int, $from: FuzzyDateInt, $to: FuzzyDateInt) { Page(page: $page, perPage: 50) { pageInfo { hasNextPage } media(type: ANIME, startDate_greater: $from, startDate_lesser: $to, sort: POPULARITY_DESC) { " + fields + " } } }";
      return search.loadMedia("era:" + era.from + ":" + era.to, open, function (page) {
        return { page: page, from: from, to: to };
      });
    }
    return Promise.all(genres.map(function (genre) {
      var query = genre.tag
        ? "query ($page: Int, $from: FuzzyDateInt, $to: FuzzyDateInt, $tag: String) { Page(page: $page, perPage: 50) { pageInfo { hasNextPage } media(type: ANIME, tag: $tag, startDate_greater: $from, startDate_lesser: $to, sort: POPULARITY_DESC) { " + fields + " } } }"
        : "query ($page: Int, $from: FuzzyDateInt, $to: FuzzyDateInt, $genre: String) { Page(page: $page, perPage: 50) { pageInfo { hasNextPage } media(type: ANIME, genre: $genre, startDate_greater: $from, startDate_lesser: $to, sort: POPULARITY_DESC) { " + fields + " } } }";
      return search.loadMedia(
        "era:" + era.from + ":" + era.to + ":" + genre.id,
        query,
        function (page) {
          var variables = { page: page, from: from, to: to };
          if (genre.tag) variables.tag = genre.tag;
          else variables.genre = genre.genre;
          return variables;
        }
      );
    })).then(function (sets) {
      var cards = sets[0] || [];
      var i;
      for (i = 1; i < sets.length; i++) cards = search.intersect(cards, sets[i]);
      return cards;
    });
  },

  overlayLists: function (cards) {
    var era = search.currentEra();
    var jobs = [];
    search.selectedPills("extra").forEach(function (pill) {
      if (pill.tag) jobs.push(search.loadTag(pill.tag, era));
    });
    if (search.lengths[search.filters.length] && search.lengths[search.filters.length].id === "shorts") {
      jobs.push(search.loadShorts(era));
    }
    if (!jobs.length) return Promise.resolve(cards);
    return Promise.all(jobs).then(function (sets) {
      var i;
      if (!cards.length) {
        cards = (sets[0] || []).slice();
        for (i = 1; i < sets.length; i++) cards = search.intersect(cards, sets[i]);
        return cards;
      }
      for (i = 0; i < sets.length; i++) cards = search.intersect(cards, sets[i]);
      return cards;
    });
  },

  intersect: function (cards, others) {
    var ids = {};
    (others || []).forEach(function (card) {
      if (card && card.id) ids[card.id] = card;
    });
    return (cards || []).filter(function (card) {
      return card && ids[card.id];
    }).map(function (card) {
      var other = ids[card.id];
      if (!card.poster && other.poster) card.poster = other.poster;
      if (!card.background && other.background) card.background = other.background;
      if (!card.year && other.year) card.year = other.year;
      if (card.rating == null && other.rating != null) card.rating = other.rating;
      return card;
    });
  },

  needsRatings: function (cards) {
    if (search.ratingFloor() == null) return false;
    return (cards || []).some(function (card) {
      return card && card.rating == null && card.id;
    });
  },

  hydrateRatings: function (cards) {
    var floor = search.ratingFloor();
    if (floor == null) return Promise.resolve(cards);
    var missing = (cards || []).filter(function (card) {
      return card && card.rating == null && card.id && search.ratingCache[card.id] == null;
    }).slice(0, 80);
    (cards || []).forEach(function (card) {
      if (card && card.rating == null && search.ratingCache[card.id] != null) {
        card.rating = search.ratingCache[card.id];
      }
    });
    var index = 0;
    function next() {
      if (index >= missing.length) return Promise.resolve(cards);
      var batch = missing.slice(index, index + 4);
      index += 4;
      return Promise.all(batch.map(search.fetchRating)).then(next);
    }
    return next();
  },

  fetchRating: function (card) {
    return new Promise(function (resolve) {
      service.object({
        data: card.id,
        success: function (json) {
          var row = json && json.data && json.data[0];
          var average = row && row.rating && Number(row.rating.average);
          card.rating = isFinite(average) && average > 0 ? average : 0;
          search.ratingCache[card.id] = card.rating;
          resolve(card);
        },
        error: function () {
          card.rating = 0;
          search.ratingCache[card.id] = 0;
          resolve(card);
        },
      });
    });
  },

  localFilter: function (cards) {
    var era = search.currentEra();
    var floor = search.ratingFloor();
    var labels = search.selectedPills("cr").map(function (pill) {
      return (pill.match || pill.label).toLowerCase();
    });
    var wantLength = search.lengthChoice().id;
    var wantAudio = search.audioChoice().id;
    return (cards || []).filter(function (card) {
      var have;
      var i;
      if (!card || !card.title) return false;
      if (wantLength === "series" && card.type === "movie_listing") return false;
      if (wantLength === "movies" && card.type !== "movie_listing") return false;
      if (wantAudio === "dubbed" && card.dubbed === false) return false;
      if (wantAudio === "subbed" && card.subbed === false) return false;
      if (labels.length) {
        have = (card.categories || []).map(function (name) {
          return String(name).toLowerCase();
        });
        for (i = 0; i < labels.length; i++) {
          if (have.indexOf(labels[i]) < 0) return false;
        }
      }
      if (era && (card.year < era.from || card.year > era.to)) return false;
      if (floor != null && (card.rating == null || card.rating < floor)) return false;
      return true;
    });
  },

  showCards: function (cards) {
    if (!document.getElementById(search.id)) return;
    search.audioAvailable = (search.pool || []).some(function (card) {
      return card && (typeof card.dubbed === "boolean" || typeof card.subbed === "boolean");
    });
    search.data.result = cards || [];
    search.renderList();
    if (search.focusZone === "results") {
      if (!search.data.result.length) {
        search.focusPills();
      } else if (search.position >= search.data.result.length) {
        search.toggleFocus(search.data.result.length - 1);
      } else {
        search.toggleFocus(search.position < 0 ? 0 : search.position);
      }
      search.scroll();
    }
    if (search.armResults) {
      search.armResults = false;
      if (search.data.result.length) search.toggleFocus(0);
      else search.focusZone = "results";
      search.scroll();
    }
    search.paintChipStates();
    search.paintPills();
    search.paintWheels();
  },

  presentPool: function () {
    search.showCards(search.localFilter(search.pool || []));
  },

  renderList: function () {
    var selectedIndex = 0;
    if (search.focusZone === "results" && search.position >= 0) {
      selectedIndex = search.position;
    } else if (search.last_postion >= 0) {
      selectedIndex = search.last_postion;
    }
    var elements_content = "";
    search.data.result.forEach(function (element, index) {
      elements_content += `
              <div class="item${index === selectedIndex ? " selected" : ""}">
                <div class="poster"><img src="${search.escape(element.poster || "")}" alt=""></div>
                <div class="title">${search.escape(element.title || "")}</div>
              </div>`;
    });

    $("#search-screen .list-container-over").html(elements_content);
    var empty = document.getElementById("search-empty");
    if (empty) {
      if (!search.data.result.length && search.searched && !search.ratingsPending) {
        empty.textContent =
          search.hasCatalogFilter() || search.lengthChoice().id !== "any" || search.audioChoice().id !== "all"
            ? "No results match these filters."
            : "No results.";
      } else {
        empty.textContent = "";
      }
    }
    search.layoutGrid();
  },

  // The list only gets the space under the filters. Three rows have to fit
  // there. Longer lists keep a poster size that can scroll the last row clear.
  layoutGrid: function () {
    var container = document.querySelector("#search-screen .list-container");
    var grid = document.querySelector("#search-screen .list-container-over");
    if (!container || !grid) return;
    var items = grid.querySelectorAll(".item");
    if (!items.length) {
      search.scroll_data.rows = 0;
      container.classList.remove("can-scroll");
      return;
    }
    var gap = 22;
    grid.style.marginTop = "0px";
    grid.style.marginLeft = "0px";
    var style = window.getComputedStyle(container);
    var padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    var padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    var availableH = container.clientHeight - padY;
    var availableW = container.clientWidth - padX;
    var posterW = 220;
    var posterH = 200;
    var columns = Math.max(1, Math.floor((availableW + gap) / (posterW + gap)));
    if (columns > 6) columns = 6;
    posterW = Math.floor((availableW - gap * (columns - 1)) / columns);
    if (posterW < 160) posterW = 160;
    posterH = Math.round(posterW * 3 / 2);
    var rows = Math.ceil(items.length / columns);
    var titleH = 58;
    var rowH = posterH + titleH;
    search.items_per_row = columns;
    search.scroll_data.item_height = rowH;
    search.scroll_data.item_padding = gap;
    search.scroll_data.rows = rows;
    Array.prototype.forEach.call(items, function (item, index) {
      item.style.width = posterW + "px";
      item.style.height = "auto";
      item.style.maxWidth = "none";
      item.style.marginLeft = "0px";
      item.style.marginRight = (index + 1) % columns === 0 ? "0px" : gap + "px";
      item.style.marginBottom = gap + "px";
      var poster = item.querySelector(".poster");
      if (poster) poster.style.height = posterH + "px";
    });
    grid.style.marginLeft = "0px";
    var overflows = rows * rowH + Math.max(0, rows - 1) * gap > availableH + 1;
    if (overflows) container.classList.add("can-scroll");
    else {
      container.classList.remove("can-scroll");
      grid.style.marginTop = "0px";
    }
  },

  escape: function (value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  },

  focusInput: function () {
    if (search.position >= 0) search.last_postion = search.position;
    search.focusZone = "input";
    search.wheelReturn = null;
    search.position = -1;
    $("#search-screen_input").addClass("focus");
    $("#search-screen .list-container").removeClass("focus");
    search.paintChipStates();
    search.paintPills();
    search.paintWheels();
  },

  focusFilters: function () {
    var chips = search.chips();
    if (!chips.length) return false;
    if (search.position >= 0) search.last_postion = search.position;
    search.focusZone = "filters";
    search.position = -1;
    if (search.filterIndex >= chips.length) search.filterIndex = 0;
    $("#search-screen_input").removeClass("focus");
    $("#search-screen .list-container").removeClass("focus");
    search.paintChipStates();
    search.paintPills();
    search.paintWheels();
    return true;
  },

  focusPills: function () {
    if (search.position >= 0) search.last_postion = search.position;
    search.focusZone = "pills";
    search.position = -1;
    var pills = search.pillDefs();
    if (search.pillIndex >= pills.length) search.pillIndex = 0;
    $("#search-screen_input").removeClass("focus");
    $("#search-screen .list-container").removeClass("focus");
    search.paintChipStates();
    search.paintPills();
    search.paintWheels();
    return true;
  },

  focusPillUnderWheel: function () {
    var start = search.pillColumns - search.wheelDefs().length;
    if (start < 0) start = 0;
    search.wheelReturn = null;
    search.pillIndex = start + search.wheelIndex;
    search.focusPills();
  },

  focusWheels: function () {
    if (search.position >= 0) search.last_postion = search.position;
    search.focusZone = "wheels";
    search.position = -1;
    if (search.wheelIndex >= search.wheelDefs().length) search.wheelIndex = 0;
    $("#search-screen_input").removeClass("focus");
    $("#search-screen .list-container").removeClass("focus");
    search.paintChipStates();
    search.paintPills();
    search.paintWheels();
    return true;
  },

  enterResults: function () {
    if (!search.data.result.length) return false;
    var index = search.last_postion;
    if (index < 0 || index >= search.data.result.length) index = 0;
    search.toggleFocus(index);
    search.scroll();
    return true;
  },

  applyFocusedChip: function () {
    var chips = search.chips();
    var chip = chips[search.filterIndex];
    if (!chip) return;
    var group = chip.getAttribute("data-group");
    var value = chip.getAttribute("data-value");
    if (search.filters[group] === value) return;
    search.filters[group] = value;
    search.paintChipStates();
    if (group === "type") {
      if (search.searched || search.hasCatalogFilter()) search.start();
      return;
    }
    if (search.pool) search.presentPool();
  },

  movePill: function (dcol, drow) {
    var cols = search.pillColumns;
    var count = search.pillDefs().length;
    var col = search.pillIndex % cols;
    var row = Math.floor(search.pillIndex / cols);
    var rows = Math.ceil(count / cols);
    if (dcol) {
      var nextCol = col + dcol;
      if (nextCol < 0) {
        menu.open();
        return;
      }
      if (nextCol >= cols) return;
      var across = row * cols + nextCol;
      if (across >= count) return;
      search.pillIndex = across;
      search.paintPills();
      return;
    }
    var nextRow = row + drow;
    if (nextRow < 0) {
      var wheelCount = search.wheelDefs().length;
      var wheelStart = search.pillColumns - wheelCount;
      if (wheelStart < 0) wheelStart = 0;
      if (col >= wheelStart) {
        search.wheelReturn = search.pillIndex;
        search.wheelIndex = col - wheelStart;
        search.focusWheels();
        return;
      }
      if (!search.focusFilters()) search.focusInput();
      return;
    }
    if (nextRow >= rows) {
      search.enterResults();
      return;
    }
    var below = nextRow * cols + col;
    if (below >= count) {
      search.enterResults();
      return;
    }
    search.pillIndex = below;
    search.paintPills();
  },

  togglePill: function () {
    var pill = search.pillDefs()[search.pillIndex];
    if (!pill) return;
    search.filters.tags[pill.id] = !search.filters.tags[pill.id];
    search.paintPills();
    search.schedule();
  },

  spinWheel: function (delta) {
    var wheels = search.wheelDefs();
    var wheel = wheels[search.wheelIndex];
    if (!wheel) return;
    var next = (search.filters[wheel.key] || 0) + delta;
    if (next < 0) {
      search.focusInput();
      return;
    }
    if (next >= wheel.values.length) {
      search.focusPillUnderWheel();
      return;
    }
    search.filters[wheel.key] = next;
    search.paintWheels();
    search.schedule();
  },

  confirmWheel: function () {
    clearTimeout(search.timer);
    search.armResults = true;
    search.paintWheels();
    search.start();
  },

  toggleFocus: function (newIndex) {
    if (newIndex < 0 || !search.data.result.length) {
      search.focusPills();
      return;
    }
    search.focusZone = "results";
    if (newIndex >= search.data.result.length) newIndex = search.data.result.length - 1;
    $("#search-screen_input").removeClass("focus");
    $("#search-screen .list-container").addClass("focus");
    $("#search-screen .list-container .item").removeClass("selected");
    $("#search-screen .list-container .item").eq(newIndex).addClass("selected");
    search.position = newIndex;
    search.paintChipStates();
    search.paintPills();
    search.paintWheels();
  },

  scroll: function () {
    if (search.focusZone !== "results" || search.data.result.length == 0) return;
    var container = document.querySelector("#search-screen .list-container");
    var row = $("#search-screen .list-container-over").get(0);
    if (!container || !row) return;
    var style = window.getComputedStyle(container);
    var available = container.clientHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0);
    var rowHeight = search.scroll_data.item_height + search.scroll_data.item_padding;
    if (!rowHeight) return;
    var visible = Math.max(1, Math.floor((available + search.scroll_data.item_padding) / rowHeight));
    var current = Math.floor(search.position / search.items_per_row);
    var maxOffset = Math.max(0, search.scroll_data.rows - visible);
    var offset = current - (visible - 1);
    if (offset < 0) offset = 0;
    if (offset > maxOffset) offset = maxOffset;
    row.style.marginTop = offset ? "-" + (offset * rowHeight) + "px" : "0px";
  },

  openResult: function () {
    var item = search.data.result[search.position];
    if (!item) return;
    home_details.init(
      item,
      function (opened) {
        var home_element = document.createElement("div");
        home_element.id = home.id;
        home_element.innerHTML = `
            <div class="content">
              <div class="details full">
                <div class="background">
                  <img src="${search.escape(opened.background)}">
                </div>
                <div class="info">
                  <div class="title resize">${search.escape(opened.title)}</div>
                  <div class="description resize">${search.escape(opened.description)}</div>
                  <div class="buttons">
                    <a class="selected">Play</a>
                    <a>More information</a>
                  </div>
                </div>
              </div>
              <div class="logo-fixed">
                <img src="server/img/logo-big.png"/>
              </div>
            </div>`;

        document.getElementById(search.id).style.display = "none";
        document.body.appendChild(home_element);
      },
      function () {
        document.getElementById(search.id).style.display = "block";
        home.destroy();
        search.toggleFocus(search.position);
      }
    );
  },

  keyDown: function (event) {
    switch (event.keyCode) {
      case tvKey.IS_KEY_BACK(event.keyCode):
        if (search.focusZone === "input") menu.open();
        else if (search.focusZone === "filters") search.focusInput();
        else if (search.focusZone === "pills") {
          if (!search.focusFilters()) search.focusInput();
        } else if (search.focusZone === "wheels") search.focusInput();
        else search.focusPills();
        break;
      case tvKey.KEY_NEXT:
        break;
      case tvKey.KEY_UP:
        if (search.focusZone === "results") {
          if (search.position < search.items_per_row) search.focusPills();
          else {
            search.toggleFocus(search.position - search.items_per_row);
            search.scroll();
          }
        } else if (search.focusZone === "wheels") {
          search.wheelReturn = null;
          search.spinWheel(-1);
        } else if (search.focusZone === "pills") search.movePill(0, -1);
        else if (search.focusZone === "filters") search.focusInput();
        break;
      case tvKey.KEY_DOWN:
        if (search.focusZone === "input") {
          if (!search.focusFilters()) search.focusPills();
        } else if (search.focusZone === "filters") search.focusPills();
        else if (search.focusZone === "pills") search.movePill(0, 1);
        else if (search.focusZone === "wheels") {
          if (search.wheelReturn != null) {
            search.pillIndex = search.wheelReturn;
            search.wheelReturn = null;
            search.focusPills();
          } else search.spinWheel(1);
        } else if (search.data.result.length) {
          search.toggleFocus(search.position + search.items_per_row);
          search.scroll();
        }
        break;
      case tvKey.KEY_LEFT:
        if (search.focusZone === "input") menu.open();
        else if (search.focusZone === "filters") {
          if (search.filterIndex > 0) {
            search.filterIndex -= 1;
            search.paintChipStates();
          } else menu.open();
        } else if (search.focusZone === "pills") search.movePill(-1, 0);
        else if (search.focusZone === "wheels") {
          search.wheelReturn = null;
          if (search.wheelIndex > 0) {
            search.wheelIndex -= 1;
            search.paintWheels();
          } else search.focusInput();
        } else if (search.focusZone === "results") {
          if (search.position % search.items_per_row == 0) menu.open();
          else search.toggleFocus(search.position - 1);
        }
        break;
      case tvKey.KEY_RIGHT:
        if (search.focusZone === "input") search.focusWheels();
        else if (search.focusZone === "filters") {
          var chips = search.chips();
          if (search.filterIndex < chips.length - 1) search.filterIndex += 1;
          search.paintChipStates();
        } else if (search.focusZone === "pills") search.movePill(1, 0);
        else if (search.focusZone === "wheels") {
          search.wheelReturn = null;
          if (search.wheelIndex < search.wheelDefs().length - 1) search.wheelIndex += 1;
          search.paintWheels();
        } else if (search.focusZone === "results") {
          if ((search.position + 1) % search.items_per_row == 0) return;
          search.toggleFocus(search.position + 1);
        }
        break;
      case tvKey.KEY_ENTER:
      case tvKey.KEY_PANEL_ENTER:
        if (search.focusZone === "input") keyboard.init(search.input, search.start);
        else if (search.focusZone === "filters") search.applyFocusedChip();
        else if (search.focusZone === "pills") search.togglePill();
        else if (search.focusZone === "wheels") search.confirmWheel();
        else if (search.focusZone === "results" && search.position < 0) return;
        else search.openResult();
        break;
    }
  },
};
