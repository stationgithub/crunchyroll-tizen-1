window.loading = {
  id: "loading-screen",
  active: false,

  // Four small transparent PNG poses decoded once and moved on the compositor.
  lineMarkup: function (maskId) {
    return (
      '<div class="bunny-spot" data-spinner="' +
      maskId +
      '" aria-hidden="true">' +
      '<div class="bunny-spinner">' +
      '<img class="bunny-pose pose-1" src="server/img/bunny-jump-1.png" alt="">' +
      '<img class="bunny-pose pose-2" src="server/img/bunny-jump-2.png" alt="">' +
      '<img class="bunny-pose pose-3" src="server/img/bunny-jump-3.png" alt="">' +
      '<img class="bunny-pose pose-4" src="server/img/bunny-jump-4.png" alt="">' +
      "</div></div>"
    );
  },

  start: function () {
    if(!document.getElementById(loading.id)) {
      loading.active = true;
      var loading_element = document.createElement("div");
      loading_element.id = loading.id;
      loading_element.className = "flat";
      loading_element.innerHTML = `
      <div class="content flat">
        <div class="loading">${loading.lineMarkup("line-spin-flat")}</div>
      </div>`;
      document.body.appendChild(loading_element);
    }
    loading.active = true;
  },

  end: function () {
    document.getElementById(loading.id) &&
      document.body.removeChild(document.getElementById(this.id));
    loading.active = false;
  },

  init: function () {
    var loading_element = document.createElement("div");
    loading_element.id = loading.id;

    loading_element.innerHTML = `
    <div class="content">
      <div class="logo">
        <img src="server/img/logo.png" alt="">
      </div>
      <div class="loading">${loading.lineMarkup("line-spin-boot")}</div>
    </div>`;
    document.body.appendChild(loading_element);

    main.state = loading.id;
  },

  destroy: function () {
    document.body.removeChild(document.getElementById(this.id));
  },

  keyDown: function (event) {
    switch (event.keyCode) {
      case tvKey.IS_KEY_BACK(event.keyCode):
      case tvKey.KEY_EXIT:
        exit.init(true);
        break;
    }
  },
};
