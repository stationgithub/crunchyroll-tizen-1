window.session = {
  languages: {
    audios: {},
    subtitles: {},
  },
  storage: {
    version: NaN,
    language: NaN,
    quality: "auto",
    account: {
      password: NaN,
      username: NaN,
      avatar: "0001-cr-white-orange.png",
      premium: false,
      language: NaN,
      audio: NaN,
    },
    profiles: [],
    cookies: {
      bucket: NaN,
      policy: NaN,
      signature: NaN,
      key_pair_id: NaN,
      expires: NaN,
    },
    profile_id: NaN,
    id: NaN,
    country: NaN,
    token_type: NaN,
    access_token: NaN,
    expires_in: NaN,
    refresh_token: NaN,
  },

  init: function () {
    service.languages({
      data: { type: "audio" },
      success: function (response) {
        session.languages.audios = response;
        session.languages.audios["ja-JP"] = "Japanese";
      },
      error: function (error) {
        console.log(error);
      },
    });

    service.languages({
      data: { type: "subtitle" },
      success: function (response) {
        session.languages.subtitles = response;
        session.languages.subtitles["Disabled"] = "Disabled";
      },
      error: function (error) {
        console.log(error);
      },
    });

    var storage = localStorage.getItem("session");
    if (storage) {
      try {
        storage = JSON.parse(storage);
        session.storage = storage || session.storage;
      } catch (error) {
        console.log("error parse session.");
      }
    }

    session.update();
  },

  start: function (username, password, callback) {
    service.token({
      data: {
        password: password,
        username: username,
      },
      success: function (response) {
        if (!session.tokenReady(response)) {
          return callback.error && callback.error(response);
        }
        session.applyToken(response);
        session.storage.account.username = username;
        session.storage.account.password = password;

        //session.loadAccountInfo();
        return callback.success(session.update());
      },
      error: function (error) {
        return callback.error && callback.error(error);
      },
    });
  },

  refresh: function (callback) {
    if (session.isExpired()) {
      service.refresh({
        data: {
          refresh_token: session.storage.refresh_token,
        },
        success: function (response) {
          if (!session.tokenReady(response)) {
            callback.error && callback.error(response);
            return;
          }
          session.applyToken(response);

          callback.success(session.update());
        },
        error: function (error) {
          callback.error && callback.error(error);
        },
      });
      return;
    }
    session.normalizeLanguages();
    callback.success(session.storage);
  },

  cookies: function (callback) {
    if (session.isExpired(true)) {
      service.cookies({
        success: function (response) {
          session.storage.cookies.bucket = response.cms.bucket;
          session.storage.account.premium =
            session.storage.cookies.bucket.includes("crunchyroll");
          session.storage.cookies.policy = response.cms.policy;
          session.storage.cookies.signature = response.cms.signature;
          session.storage.cookies.key_pair_id = response.cms.key_pair_id;
          session.storage.cookies.expires = new Date(
            response.cms.expires
          ).getTime();

          callback.success(session.update());
        },
        error: function (error) {
          callback.error(error);
        },
      });
    } else {
      callback.success(session.storage);
    }
  },

  load_account: function (callback) {
    service.profile({
      success: function (response) {
        session.storage.account.audio =
          response.preferred_content_audio_language;
        session.storage.account.language =
          response.preferred_content_subtitle_language;
        session.storage.account.avatar = response.avatar;
        session.storage.account.mature = response.maturity_rating;
        session.storage.account.username = response.username;
        session.update();
        // load additional profiles
        session.load_profiles(callback);
      },
      error: callback.error,
    });

    session.cookies({
      success: function (response) {},
      error: function (error) {},
    });
  },

  load_profiles: function (callback) {
    try {
      service.profiles({
        success: function (response) {
          session.storage.profiles = response.profiles;
          session.update();
          callback && callback.success();
        }
      });

      session.cookies({
        success: function (response) {},
        error: function (error) {},
      });
    } catch (e) {
      console.error("load_profiles", e);
    }
  },

  switch_profile: function (callback, profile_id) {
    return service.switchProfile(
      {
        success: (json) => {
          session.storage.expires_in = new Date().setSeconds(
            new Date().getSeconds() + json.expires_in
          );
          session.storage.id = json.account_id;
          session.storage.profile_id = json.profile_id;
          session.storage.country = json.country;
          session.storage.token_type = json.token_type;
          session.storage.access_token = json.access_token;
          session.storage.refresh_token = json.refresh_token;
          session.update();

          // refresh profiles to set correct is_selected status
          service.profiles({
            success: (response) => {
              session.storage.profiles = response.profiles;

              session.storage.profiles.forEach((profile) => {
                if (profile.is_selected) {
                  session.storage.account.audio =
                    profile.preferred_content_audio_language;
                  session.storage.account.language =
                    profile.preferred_content_subtitle_language;
                  session.storage.account.avatar = profile.avatar;
                }
              });

              session.update();

              return callback.success(json);
            },
            error: console.error,
          });
        },
        error: callback.error,
      },
      profile_id
    );
  },

  // return session token, if expires refresh, if doesn't exist returns undefined
  valid: function (callback) {
    if (session.storage && session.storage.access_token) {
      return session.refresh(callback);
    }
    return callback.error();
  },

  isExpired: function (coockie_type) {
    var expire_date = coockie_type
      ? session.storage.cookies.expires
      : session.storage.expires_in;
    return !(expire_date && expire_date >= new Date().getTime());
  },

  // A missing locale must stay missing in memory only long enough to be
  // replaced. The string "undefined" is what a template writes for a missing
  // value, and Crunchyroll rejects it as a language.
  usableLanguage: function (value, fallback) {
    var standIn = fallback === undefined ? "en-US" : fallback;
    if (typeof value !== "string") {
      return standIn;
    }
    var text = value.trim();
    var word = text.toLowerCase();
    if (!text || word === "undefined" || word === "null") {
      return standIn;
    }
    return text;
  },

  // A failed token body is still JSON, so it arrives on the success path.
  // Writing that missing token and then saving the session drops the login.
  tokenReady: function (response) {
    if (!response || typeof response.access_token !== "string") return false;
    var token = response.access_token.trim();
    var word = token.toLowerCase();
    return !!token && word !== "undefined" && word !== "null";
  },

  applyToken: function (response) {
    if (typeof response.expires_in === "number") {
      session.storage.expires_in = new Date().setSeconds(
        new Date().getSeconds() + response.expires_in
      );
    }
    if (response.account_id) session.storage.id = response.account_id;
    if (response.country) session.storage.country = response.country;
    if (response.token_type) session.storage.token_type = response.token_type;
    session.storage.access_token = response.access_token;
    if (
      typeof response.refresh_token === "string" &&
      response.refresh_token.trim() &&
      response.refresh_token.toLowerCase() !== "undefined" &&
      response.refresh_token.toLowerCase() !== "null"
    ) {
      session.storage.refresh_token = response.refresh_token;
    }
  },

  normalizeLanguages: function () {
    if (!session.storage.account) {
      session.storage.account = {};
    }
    session.storage.language = session.usableLanguage(
      session.storage.language,
      "en-US"
    );
    session.storage.account.language = session.usableLanguage(
      session.storage.account.language,
      "en-US"
    );
    session.storage.account.audio = session.usableLanguage(
      session.storage.account.audio,
      "en-US"
    );
  },

  update: function () {
    session.normalizeLanguages();
    localStorage.setItem("session", JSON.stringify(session.storage));
    return session.storage;
  },

  get_active_profile_name: function () {
    var profiles = session.storage.profiles;

    for (var i = 0; i < profiles.length; i++) {
      var is_selected = profiles[i].is_selected;
      var profile_name = profiles[i].profile_name;
      var username = profiles[i].username;

      if (is_selected) {
        return profile_name ? profile_name : username;
      }
    }

    return session.storage.account.username;
  },

  clear: function () {
    session.storage = {
      language: "en-US",
      quality: "auto",
      account: {
        password: NaN,
        username: NaN,
        mature: NaN,
        avatar: "0001-cr-white-orange.png",
        premium: false,
        language: "en-US",
        audio: "",
      },
      profiles: [],
      cookies: {
        bucket: NaN,
        policy: NaN,
        signature: NaN,
        key_pair_id: NaN,
        expires: NaN,
      },
      profile_id: NaN,
      id: NaN,
      country: NaN,
      token_type: NaN,
      access_token: NaN,
      expires_in: NaN,
      refresh_token: NaN,
    };
    session.update();
  },
};
