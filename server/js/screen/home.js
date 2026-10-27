window.home = {
  id: "home-screen",
  data: {
    main: NaN,
  },
  position: 0,
  slides: [],
  slideIndex: 0,
  slideTimer: null,
  slideHold: 8000,
  saved: false,
  watchToken: 0,
  fromCategory: {
    index: NaN,
    state: false,
  },
  iconPlay:
    '<svg viewBox="0 0 18 18" aria-hidden="true"><path fill="currentColor" d="M5 3.2v11.6L15 9 5 3.2z"/></svg>',
  iconInfo:
    '<svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path fill="currentColor" d="M8.1 8h1.8v5H8.1zm0-2.6h1.8V7H8.1z"/></svg>',
  iconSave:
    '<svg class="icon-save" viewBox="0 0 18 18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M5 3h8v12l-4-2.4L5 15V3z"/></svg>',

  init: function () {
    var home_element = document.createElement("div");
    home_element.id = home.id;

    var poster_items = ``;
    home.data.main.lists.forEach((element, index) => {
      if (element.items.length > 0) {
        poster_items += `
      <div class="row">
        <div class="row-title">${home.shelfTitle(element)}</div>
        <div class="row-content ${element.items[0].display}">`;
        element.items.forEach((item) => {
          poster_items += home.createItem(item);
        });
        for (var index = 0; index < 9; index++) {
          poster_items += home.createEmptyItem(element.items[0].display);
        }
        poster_items += `</div></div>`;
      }
    });

    home_element.innerHTML = `
    <div class="content">
      ${
        home.fromCategory.state
          ? `<div class="browse-back"><span></span><p>${home.fromCategory.title}</p></div>`
          : ""
      }
      <div class="details full">
        <div class="background">
          <img class="banner-layer shown" src="${home.data.main.banner.background}" alt="">
          <img class="banner-layer" alt="">
        </div>
        <div class="info">
          <div class="title resize"><span>${home.data.main.banner.title}</span></div>
          <div class="meta"></div>
          <div class="description resize">${home.firstSentence(
            home.data.main.banner.description
          )}</div>
          <div class="buttons">
            <a class="selected" data-action="play" aria-label="${translate.go(
              "home.banner.play"
            )}">${home.iconPlay}</a>
            <a data-action="info" aria-label="${translate.go(
              "home.banner.info"
            )}">${home.iconInfo}</a>
            <a data-action="save" aria-label="${translate.go(
              "home.details.add"
            )}">${home.iconSave}</a>
          </div>
        </div>
        <div class="hero-dots" aria-hidden="true"></div>
      </div>
      <div class="rows">
        <div class="rows-track">
          ${poster_items}
        </div>
      </div>
      <div class="logo-fixed">
        <img src="server/img/logo-big.png"/>
      </div>
    </div>`;

    document.body.appendChild(home_element);

    var rails = $(`#${home.id} .rows .row-content`);
    rails.not(".episode").slick(shelf.railOptions({ slidesToShow: 10 }));

    rails.filter(".episode").slick(shelf.railOptions({ slidesToShow: 5.5 }));

    if (rails.length) {
      home.scrollRows(0);
      rails[0].slick.slickGoTo(0);
    }

    main.state = home.id;
    try {
      home.slides = home.collectSlides();
      home.slideIndex = 0;
      home.watchId = (home.slides[0] && home.slides[0].id) || "";
      home.applyCopy(home.slides[0] || home.data.main.banner);
      home.paintDots();
      home.syncSave(home.slides[0] || home.data.main.banner);
      home.armSlide();
    } catch (error) {
      console.log(error);
    }
    changelog.init();
  },

  destroy: function () {
    home.stopCarousel();
    home.position = 0;
    home.slides = [];
    home.slideIndex = 0;
    document.body.removeChild(document.getElementById(home.id));
  },

  scrollRows: function (index) {
    shelf.scrollTo(
      $(`#${home.id} .rows-track`)[0],
      $(`#${home.id} .rows-track .row`)[index]
    );
  },

  show_details: function () {
    if (home.position > 0) {
      home.stopCarousel();
      var item =
        home.data.main.lists[home.position - 1].items[
          $(".row-content")[home.position - 1].slick.currentSlide
        ];
      shelf.swapBanner(document.getElementById(home.id), item);
      home.applyCopy(item);
      return;
    }
    if (!home.slides || !home.slides.length) {
      home.slides = home.collectSlides();
      home.slideIndex = 0;
    }
    home.showSlide(home.slideIndex || 0);
  },

  currentSlide: function () {
    var slides = home.slides || [];
    if (!slides.length) {
      return home.data.main && home.data.main.banner;
    }
    return slides[home.slideIndex] || slides[0];
  },

  collectSlides: function () {
    var slides = [];
    var seen = {};
    var push = function (item, allowPlaceholder) {
      if (!item || !item.background || !item.title) {
        return;
      }
      if (
        !allowPlaceholder &&
        String(item.background).indexOf("dummyimage.com") !== -1
      ) {
        return;
      }
      var key = item.id || item.title;
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      slides.push(item);
    };
    var main = home.data.main;
    if (!main) {
      return slides;
    }
    push(main.banner, true);
    var lists = main.lists || [];
    var i;
    var j;
    for (i = 0; i < lists.length && slides.length < 3; i++) {
      var preferred = lists[i].items || [];
      for (j = 0; j < preferred.length && slides.length < 3; j++) {
        var series = preferred[j];
        if (
          !series ||
          series.display === "episode" ||
          series.type === "episode" ||
          series.type === "movie"
        ) {
          continue;
        }
        push(series, false);
      }
    }
    if (slides.length < 2) {
      for (i = 0; i < lists.length && slides.length < 3; i++) {
        var extras = lists[i].items || [];
        for (j = 0; j < extras.length && slides.length < 3; j++) {
          push(extras[j], false);
        }
      }
    }
    return slides;
  },

  showSlide: function (index) {
    var slides = home.slides || [];
    if (!slides.length) {
      return;
    }
    var next = ((index % slides.length) + slides.length) % slides.length;
    home.slideIndex = next;
    var item = slides[next];
    var root = document.getElementById(home.id);
    if (window.shelf && root) {
      shelf.swapBanner(root, item);
    }
    home.applyCopy(item);
    if (item.id !== home.watchId) {
      home.watchId = item.id || "";
      home.syncSave(item);
    }
    home.paintDots();
    home.armSlide();
  },

  armSlide: function () {
    home.stopCarousel();
    if (!home.slides || home.slides.length < 2 || home.position !== 0) {
      return;
    }
    if (!document.getElementById(home.id)) {
      return;
    }
    home.slideTimer = setTimeout(function () {
      home.slideTimer = null;
      if (!document.getElementById(home.id) || home.position !== 0) {
        return;
      }
      if (main.state !== home.id) {
        home.armSlide();
        return;
      }
      home.showSlide(home.slideIndex + 1);
    }, home.slideHold);
  },

  stopCarousel: function () {
    if (home.slideTimer) {
      clearTimeout(home.slideTimer);
      home.slideTimer = null;
    }
  },

  paintDots: function () {
    var row = document.querySelector("#" + home.id + " .hero-dots");
    if (!row) {
      return;
    }
    var count = (home.slides || []).length;
    row.innerHTML = "";
    if (count < 2) {
      row.classList.add("is-hidden");
      return;
    }
    row.classList.remove("is-hidden");
    row.style.setProperty("--hero-hold", home.slideHold / 1000 + "s");
    var active = home.slideIndex || 0;
    var i;
    for (i = 0; i < count; i++) {
      var dot = document.createElement("span");
      dot.className = "dot" + (i === active ? " on" : "");
      row.appendChild(dot);
    }
  },

  focusPlay: function () {
    var buttons = document.querySelectorAll(
      "#" + home.id + " .details .buttons a"
    );
    var i;
    for (i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle(
        "selected",
        buttons[i].getAttribute("data-action") === "play"
      );
    }
  },

  heroButtons: function () {
    return document.querySelectorAll(
      "#" + home.id + " .details .info .buttons a"
    );
  },

  // Save is hidden when the slide has no series id. Left/Right skip it.
  heroCircleOpen: function (button) {
    if (!button || button.classList.contains("is-hidden")) {
      return false;
    }
    var action = button.getAttribute("data-action");
    if (!action) {
      return false;
    }
    if (action === "save") {
      var item = home.currentSlide();
      if (!item || !item.id) {
        return false;
      }
    }
    return true;
  },

  selectHeroCircle: function (buttons, index) {
    var i;
    for (i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle("selected", i === index);
    }
  },

  nearestOpenHeroCircle: function (buttons, from, direction) {
    var i;
    if (direction < 0) {
      for (i = from - 1; i >= 0; i--) {
        if (home.heroCircleOpen(buttons[i])) {
          return i;
        }
      }
      return -1;
    }
    for (i = from + 1; i < buttons.length; i++) {
      if (home.heroCircleOpen(buttons[i])) {
        return i;
      }
    }
    return -1;
  },

  keepHeroCircleVisible: function () {
    var buttons = home.heroButtons();
    var current = -1;
    var i;
    var target;
    for (i = 0; i < buttons.length; i++) {
      if (buttons[i].classList.contains("selected")) {
        current = i;
        break;
      }
    }
    if (current >= 0 && home.heroCircleOpen(buttons[current])) {
      return;
    }
    target = -1;
    if (current >= 0) {
      target = home.nearestOpenHeroCircle(buttons, current, -1);
    }
    if (target < 0) {
      target = home.nearestOpenHeroCircle(buttons, -1, 1);
    }
    if (target < 0) {
      return;
    }
    home.selectHeroCircle(buttons, target);
  },

  moveHeroCircle: function (direction) {
    var buttons = home.heroButtons();
    var current = -1;
    var i;
    var target;
    for (i = 0; i < buttons.length; i++) {
      if (buttons[i].classList.contains("selected")) {
        current = i;
        break;
      }
    }
    if (current < 0) {
      home.keepHeroCircleVisible();
      return "stay";
    }
    target = home.nearestOpenHeroCircle(buttons, current, direction);
    if (target >= 0) {
      home.selectHeroCircle(buttons, target);
      return "moved";
    }
    if (home.heroCircleOpen(buttons[current])) {
      return direction < 0 ? "menu" : "stay";
    }
    home.keepHeroCircleVisible();
    return "stay";
  },

  firstSentence: function (text) {
    var trimmed = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!trimmed) {
      return "";
    }
    var match = trimmed.match(/^[^.!?。！？]+[.!?。！？]/);
    return match ? match[0].trim() : trimmed;
  },

  applyCopy: function (item) {
    var root = document.getElementById(home.id);
    if (!root || !item) {
      return;
    }
    var heading = root.querySelector(".details .info .title");
    var summary = root.querySelector(".details .info .description");
    var meta = root.querySelector(".details .info .meta");
    if (heading) {
      var line = heading.querySelector("span");
      if (line) line.textContent = item.title || "";
      else heading.textContent = item.title || "";
    }
    if (summary) {
      summary.textContent = home.firstSentence(item.description);
    }
    if (!meta) {
      return;
    }
    while (meta.firstChild) {
      meta.removeChild(meta.firstChild);
    }
    var count = item.episodeCount;
    if (typeof count === "number" && isFinite(count) && count > 0) {
      var word = translate.go("home.details.episodes");
      if (count === 1 && word === "Episodes") {
        word = "Episode";
      }
      var countEl = document.createElement("span");
      countEl.className = "count";
      countEl.textContent = count + " " + word;
      meta.appendChild(countEl);
    }
    if (item.status === "STREAMING" || item.status === "COMPLETE") {
      var statusEl = document.createElement("span");
      statusEl.className = "status";
      statusEl.textContent = "[" + item.status + "]";
      meta.appendChild(statusEl);
    }
    home.heroId = item.id || "";
    home.seriesLength(item);
    home.loadHeroScore(item);
  },

  shelfTitle: function (row) {
    var title = String((row && row.title) || "");
    var type = String((row && row.responseType) || "");
    if (title.toLowerCase().indexOf("top pick") !== -1 || type === "recommendations") {
      return "Crunchyroll recommendations";
    }
    return title;
  },

  loadHeroScore: function (item) {
    var token = (home.scoreToken || 0) + 1;
    home.scoreToken = token;
    var info = document.querySelector("#" + home.id + " .details .info");
    var existing = info && info.querySelector(".rating");
    if (existing) existing.remove();
    if (!item || !item.id || !window.home_details) return;
    var ready = home_details.audienceScore(item);
    if (ready) {
      home.paintHeroScore(ready, token);
      return;
    }
    service.object({
      data: item.id,
      success: function (response) {
        if (token !== home.scoreToken) return;
        home.paintHeroScore(home_details.audienceScore(response), token);
      },
      error: function (error) {
        console.log(error);
      },
    });
  },

  paintHeroScore: function (label, token) {
    if (token !== home.scoreToken || !label) return;
    home.placeScore(label);
  },

  placeScore: function (label) {
    var info = document.querySelector("#" + home.id + " .details .info");
    if (!info) return;
    var existing = info.querySelector(".rating");
    if (existing) existing.remove();
    if (!label) return;
    var meta = info.querySelector(".meta");
    if (!meta) return;
    var node = document.createElement("span");
    node.className = "rating";
    var icon = document.createElement("i");
    icon.className = "fa-solid fa-star";
    icon.setAttribute("aria-hidden", "true");
    var text = document.createElement("span");
    text.textContent = label;
    node.appendChild(icon);
    node.appendChild(text);
    meta.appendChild(node);
  },

  // Most common episode length for this series, in whole minutes.
  // The series record has a count and no runtime, so the first season supplies it.
  seriesLength: function (item) {
    if (!item || !item.id || item.type === "movie" || item.type === "episode") {
      return;
    }
    var cached = home.lengthById && home.lengthById[item.id];
    if (cached) {
      home.paintLength(item.id, cached);
      return;
    }
    var token = (home.lengthToken || 0) + 1;
    home.lengthToken = token;
    var seriesId = item.id;
    service.seasons({
      data: { id: seriesId },
      success: function (response) {
        if (token !== home.lengthToken) {
          return;
        }
        var seasons = [];
        try {
          seasons = mapper.seasons(response) || [];
        } catch (error) {
          seasons = [];
        }
        if (!seasons.length || !seasons[0].id) {
          return;
        }
        service.episodes({
          data: { id: seasons[0].id },
          success: function (episodeResponse) {
            if (token !== home.lengthToken) {
              return;
            }
            var minutes = home.typicalMinutes(episodeResponse);
            if (!minutes) {
              return;
            }
            if (!home.lengthById) {
              home.lengthById = {};
            }
            home.lengthById[seriesId] = minutes;
            home.paintLength(seriesId, minutes);
          },
        });
      },
    });
  },

  typicalMinutes: function (response) {
    var items = (response && response.items) || [];
    var counts = {};
    var best = 0;
    var bestCount = 0;
    items.forEach(function (episode) {
      var minutes = Math.round((episode.duration_ms || 0) / 60000);
      if (minutes <= 0) {
        return;
      }
      counts[minutes] = (counts[minutes] || 0) + 1;
      if (counts[minutes] > bestCount) {
        best = minutes;
        bestCount = counts[minutes];
      }
    });
    return best;
  },

  paintLength: function (seriesId, minutes) {
    if (home.heroId !== seriesId) {
      return;
    }
    var root = document.getElementById(home.id);
    var countEl = root && root.querySelector(".details .info .meta .count");
    if (!countEl) {
      return;
    }
    var base = countEl.getAttribute("data-base") || countEl.textContent;
    countEl.setAttribute("data-base", base);
    countEl.textContent = base + " · " + minutes + " min";
  },

  syncSave: function (item) {
    var button = document.querySelector(
      "#" + home.id + " .details .buttons a[data-action='save']"
    );
    if (!button) {
      return;
    }
    var token = (home.watchToken || 0) + 1;
    home.watchToken = token;
    home.saved = false;
    button.classList.remove("is-saved");
    if (!item || !item.id || !window.mylist || !window.service) {
      button.classList.add("is-hidden");
      if (button.classList.contains("selected")) {
        home.keepHeroCircleVisible();
      }
      return;
    }
    button.classList.remove("is-hidden");
    service.inWatchList({
      data: item.id,
      success: function (response) {
        if (token !== home.watchToken) {
          return;
        }
        home.saved = !!(response && response.data && response.data.length > 0);
        button.classList.toggle("is-saved", home.saved);
      },
      error: function (error) {
        if (token !== home.watchToken) {
          return;
        }
        home.saved = false;
        console.log(error);
      },
    });
  },

  toggleSave: function (item) {
    if (!item || !item.id || !window.mylist) {
      return;
    }
    var button = document.querySelector(
      "#" + home.id + " .details .buttons a[data-action='save']"
    );
    var savedId = item.id;
    loading.start();
    mylist.toggleStatus(savedId, !home.saved, {
      success: function () {
        if (home.watchId !== savedId) {
          loading.end();
          return;
        }
        home.saved = !home.saved;
        if (button) {
          button.classList.toggle("is-saved", home.saved);
        }
        loading.end();
      },
      error: function (error) {
        console.log(error);
        loading.end();
      },
    });
  },

  play: function (item) {
    if (!item) {
      return;
    }
    home.stopCarousel();
    if (item.type === "movie") {
      home_details.init(item);
      return;
    }
    var openDetails = function () {
      loading.end();
      home_details.init(item);
    };
    var start = function (next) {
      loading.end();
      if (next && next.stream) {
        video.init(next);
        return;
      }
      home_details.init(item);
    };
    var saved = home_details.savedEpisode(item);
    if (saved) {
      video.init(saved);
      return;
    }
    loading.start();
    service.continue({
      data: { ids: item.id },
      success: function (response) {
        var next;
        try {
          next = mapper.continue(response);
        } catch (error) {
          console.log(error);
          openDetails();
          return;
        }
        start(next);
      },
      error: function (error) {
        console.log(error);
        openDetails();
      },
    });
  },

  keyDown: function (event) {
    switch (event.keyCode) {
      case tvKey.IS_KEY_BACK(event.keyCode):
        if (!home.fromCategory.state) {
          menu.open();
        } else {
          home.destroy();
          browse.init(home.fromCategory.index);
        }
        break;
      case tvKey.KEY_NEXT:
        break;
      case tvKey.KEY_UP:
        $(".row-content").removeClass("selected");
        if (home.position > 1) {
          home.position--;
          home.scrollRows(home.position - 1);
          $(".row-content")[home.position - 1].slick.slickGoTo(
            $(".row-content")[home.position - 1].slick.getCurrent()
          );
          $(".row-content")[home.position - 1].className =
            $(".row-content")[home.position - 1].className + " selected";
        } else {
          $(".details").addClass("full");
          home.position = 0;
          home.focusPlay();
        }
        home.show_details();
        break;
      case tvKey.KEY_DOWN:
        if (home.position > 0) {
          $(".row-content").removeClass("selected");
          home.position =
            home.position < home.data.main.lists.length
              ? home.position + 1
              : home.position;
          if (home.position <= home.data.main.lists.length) {
            home.scrollRows(home.position - 1);
            $(".row-content")[home.position - 1].slick.slickGoTo(
              $(".row-content")[home.position - 1].slick.getCurrent()
            );
          }
          $(".row-content")[home.position - 1].className =
            $(".row-content")[home.position - 1].className + " selected";
        } else {
          var first_row = document.querySelector(
            "#" + home.id + " .rows .row-content"
          );
          if (!first_row || !first_row.slick) {
            break;
          }
          $(".details.full").removeClass("full");
          home.scrollRows(0);
          first_row.slick.slickGoTo(first_row.slick.getCurrent());
          first_row.className = first_row.className + " selected";
          home.position++;
        }
        home.show_details();
        break;
      case tvKey.KEY_LEFT:
        if (home.position > 0) {
          if ($(".row-content")[home.position - 1].slick.currentSlide === 0) {
            if (!home.fromCategory.state) {
              menu.open();
            } else {
              home.destroy();
              browse.init(home.fromCategory.index);
            }
          } else {
            $(".row-content")[home.position - 1].slick.prev();
            home.show_details();
          }
        } else if (home.moveHeroCircle(-1) === "menu") {
          if (!home.fromCategory.state) {
            menu.open();
          } else {
            home.destroy();
            browse.init(home.fromCategory.index);
          }
        }
        break;
      case tvKey.KEY_RIGHT:
        if (home.position > 0) {
          var currentList = home.data.main.lists[home.position - 1];
          var currentSlide = $(".row-content")[home.position - 1];

          if (currentSlide.slick.currentSlide < currentList.items.length - 1) {
            if (home.fromCategory.state && currentList.lazy) {
              if (
                currentList.items.length > 15 &&
                currentSlide.slick.currentSlide > currentList.items.length - 10
              ) {
                currentList.lazy = false;
                loading.start();
                mapper.loadCategoryListAsync(
                  `${home.data.main.category},${currentList.id}`,
                  currentList.items.length,
                  20,
                  home.position - 1,
                  {
                    success: function (response, index) {
                      home.data.main.lists[index].lazy =
                        response.items.length === 20;
                      home.addToList(index, mapper.mapItems(response.items));
                      loading.end();
                    },
                    error: function (error) {
                      console.log(error);
                      loading.end();
                    },
                  }
                );
              }
            }
            currentSlide.slick.next();
            home.show_details();
          }
        } else {
          home.moveHeroCircle(1);
        }
        break;
      case tvKey.KEY_ENTER:
      case tvKey.KEY_PANEL_ENTER:
        var item =
          home.position > 0
            ? home.data.main.lists[home.position - 1].items[
                $(".row-content")[home.position - 1].slick.currentSlide
              ]
            : home.currentSlide();
        if (home.position > 0) {
          home_details.init(item);
          break;
        }
        var selected = document.querySelector(
          "#" + home.id + " .details .buttons a.selected"
        );
        var action = selected ? selected.getAttribute("data-action") : "play";
        if (action === "play") {
          home.play(item);
        } else if (action === "save") {
          home.toggleSave(item);
        } else {
          home_details.init(item);
        }
        break;
    }
  },

  restart: function () {
    home.fromCategory.state = false;
    home.fromCategory.index = NaN;
    loading.start();
    home.data.main = null;
    service.home({
      success: function (response) {
        if (!response || !Array.isArray(response.data)) {
          loading.end();
          return;
        }
        try {
          mapper.home(response, {
            success: function () {
              try {
                home.init();
                home.holdLoadingForRows();
              } catch (error) {
                console.log(error);
                loading.end();
              }
            },
          });
        } catch (error) {
          console.log(error);
          loading.end();
        }
      },
      error: function (error) {
        loading.end();
        console.log(error);
      },
    });
  },

  // Spinner stays up through the first paint that has a row. The hero image
  // is part of that paint: dismissing the spinner while it is still decoding
  // leaves the black home screen. A feed error ends the spinner from restart.
  holdLoadingForRows: function () {
    var screen = document.getElementById(home.id);
    var reveal = function () {
      requestAnimationFrame(function () {
        loading.end();
      });
    };
    if (!screen) {
      loading.end();
      return;
    }
    var row = screen.querySelector(".rows .row");
    var banner =
      screen.querySelector(".details .background img.shown") ||
      screen.querySelector(".details .background img");
    var finish = reveal;
    if (!row) {
      finish();
      return;
    }
    requestAnimationFrame(function () {
      if (!banner || !banner.getAttribute("src") || banner.complete) {
        finish();
        return;
      }
      var done = false;
      var ready = function () {
        if (done) {
          return;
        }
        done = true;
        finish();
      };
      banner.addEventListener("load", ready);
      banner.addEventListener("error", ready);
      if (banner.complete) {
        ready();
      }
    });
  },

  addToList: function (index, newItems) {
    var itemsCount = home.data.main.lists[index].items.length;
    var currentSlide = $(".row-content")[home.position - 1];
    home.data.main.lists[index].items =
      home.data.main.lists[index].items.concat(newItems);

    // remove empty items for prevent move error
    for (var index = 0; index < 9; index++) {
      currentSlide.slick.slickRemove(itemsCount + 8 - index);
    }

    // added new items
    newItems.forEach((element) =>
      currentSlide.slick.slickAdd(home.createItem(element))
    );

    // added empty items for prevent move error
    for (var index = 0; index < 9; index++) {
      currentSlide.slick.slickAdd(home.createEmptyItem(newItems[0].display));
    }
  },

  createItem: function (item) {
    var playhead =
      item.display === "serie" ? "" : mapper.progressPill(item);
    return `
    <div class="item">
      <div class="poster ${item.display}">
        ${
          item.display !== "serie"
            ? '<img src="' + item.background + '">' + playhead
            : '<img src="' + item.poster + '">'
        }
      </div>
    </div>`;
  },

  createEmptyItem: function (type) {
    return `
    <div class="item">
      <div class="poster ${type}">
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=">
      </div>
    </div>`;
  },
};
