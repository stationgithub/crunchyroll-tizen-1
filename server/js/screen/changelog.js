window.changelog = {
  id: "changelog-modal",
  data: {
    version: "v1.1.6",
    changes: [],
  },

  init: function () {
    session.storage.version = changelog.data.version;
    session.update();
  },

  destroy: function () {
    main.state = home.id;
    document.body.removeChild(document.getElementById(changelog.id));
  },

  getChanges: function (item) {
    var content_changes = "";
    changelog.data.changes.forEach((element) => {
      content_changes += `
      <li>
        <div class="change-title">
          ${element.title}
        </div>
        <div class="change-description">
          ${element.description} 
        </div>
      </li>`;
    });
    return content_changes;
  },

  keyDown: function (event) {
    switch (event.keyCode) {
      case tvKey.KEY_PANEL_ENTER:
      case tvKey.KEY_ENTER:
      case tvKey.IS_KEY_BACK(event.keyCode):
        changelog.destroy();
        break;
    }
  },
};
