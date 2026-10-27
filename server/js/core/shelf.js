// Shelf motion shared by the home and my list screens. Vertical moves are one
// translate3d on the track. Horizontal rails stay on slick, but the timing
// lives on .slick-track in CSS so a new move retargets instead of restarting.
window.shelf = {
  ease: "cubic-bezier(0.32, 0.45, 0.2, 1)",

  reducedMotion: function () {
    return (
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  },

  railOptions: function (options) {
    return Object.assign(
      {
        dots: false,
        arrows: false,
        infinite: false,
        slidesToScroll: 1,
        speed: shelf.reducedMotion() ? 0 : 720,
        cssEase: shelf.ease,
        useTransform: true,
        waitForAnimate: false,
      },
      options
    );
  },

  // Scrolls a list (position: relative) just enough to keep `item` inside a
  // viewport of `height` px.
  reveal: function (list, item, height) {
    if (!list || !item || !(height > 0)) {
      return;
    }
    var offset = -(list._offset || 0);
    var top = item.offsetTop;
    var bottom = top + item.offsetHeight;
    if (top < offset) {
      offset = top;
    } else if (bottom > offset + height) {
      offset = bottom - height;
    }
    list._offset = -Math.max(0, offset);
    list.style.transform = "translate3d(0," + list._offset + "px,0)";
  },

  // Moves `track` so `row` sits at the top of the track's viewport.
  scrollTo: function (track, row) {
    if (!track) {
      return;
    }
    var y = row ? row.offsetTop : 0;
    track.style.transform = "translate3d(0," + -y + "px,0)";
  },

  // Crossfades the hero image and dips the title onto the new show.
  // `root` is the screen element. Two images live in `.details .background`.
  swapBanner: function (root, item) {
    if (!root || !item) {
      return;
    }
    var bg = root.querySelector(".details .background");
    if (!bg) {
      return;
    }
    var images = bg.querySelectorAll("img");
    if (images.length < 2) {
      var extra = document.createElement("img");
      extra.className = "banner-layer";
      extra.alt = "";
      bg.appendChild(extra);
      images = bg.querySelectorAll("img");
    }
    var shown = bg.querySelector("img.shown") || images[0];
    shown.classList.add("banner-layer");
    shown.classList.add("shown");
    var nextUrl = item.background || "";
    var title = item.title || "";
    var fillFirst = !shown.getAttribute("src") && nextUrl;
    if (
      !fillFirst &&
      shown.getAttribute("src") === nextUrl &&
      root._bannerTitle === title
    ) {
      return;
    }
    var token = (root._bannerToken || 0) + 1;
    root._bannerToken = token;
    root._bannerTitle = title;
    if (fillFirst) {
      shown.src = nextUrl;
    } else {
      var hidden = images[0] === shown ? images[1] : images[0];
      hidden.classList.add("banner-layer");
      var reveal = function () {
        if (root._bannerToken !== token) {
          return;
        }
        hidden.classList.add("shown");
        shown.classList.remove("shown");
      };
      if (hidden.getAttribute("src") === nextUrl) {
        reveal();
      } else {
        hidden.onload = function () {
          hidden.onload = null;
          reveal();
        };
        hidden.src = nextUrl;
      }
    }
    var info = root.querySelector(".details .info, .details .information");
    var heading = root.querySelector(
      ".details .info .title, .details #generic-title"
    );
    var summary = root.querySelector(
      ".details .info .description, .details #generic-description"
    );
    if (heading) {
      heading.textContent = title;
    }
    if (summary) {
      summary.textContent = item.description || "";
    }
    if (!info) {
      return;
    }
    info.classList.remove("dip");
    void info.offsetWidth;
    info.classList.add("dip");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (root._bannerToken === token) {
          info.classList.remove("dip");
        }
      });
    });
  },
};
