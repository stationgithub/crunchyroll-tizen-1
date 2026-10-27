window.translate = {
  lang: "en",

  init: function () {
    translate.updateLanguage(session.usableLanguage(session.storage.language, "en-US"));
  },

  refresh: function () {
    var elements = document.querySelectorAll("[translate]");
    elements.forEach(
      (element) => (element.innerText = translate.go(element.innerText))
    );
  },

  go: function (key, params) {
    var keys = key.split(".");
    var text = key;
    try {
      var text = keys.reduce((obj, i) => obj[i], languages[translate.lang]);
      if (typeof text !== "string") {
        throw new Error("missing");
      }
      text = params ? translate.withParams(text, params) : text;
    } catch (error) {
      try {
        var text = keys.reduce((obj, i) => obj[i], languages["en"]);
        text = params ? translate.withParams(text, params) : text;
      } catch (error) {
        console.log('no translate for ' + key)
      }
    }
    return text || key;
  },

  withParams: function (message, params) {
    return Object.keys(params).reduce(
      (param, key) =>
        param.replace(new RegExp(`{\s*${key}\s*}`, "g"), params[key]),
      message
    );
  },

  updateLanguage: function (lang) {
    var code = session.usableLanguage(lang, "en-US");
    var short = code.split("-")[0];
    translate.lang = languages[short] ? short : "en";
    session.storage.language = code;
    session.update();
  },
};
