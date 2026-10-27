window.service = {
  api: {
    url: "https://beta-api.crunchyroll.com",
    static: "https://static.crunchyroll.com",
    drm: "https://cr-play-service.prd.crunchyrollsvc.com",
    //url: "http://api.crunchyroll.local",
    //static: "http://static.crunchyroll.local",
    auth: "Basic eHVuaWh2ZWRidDNtYmlzdWhldnQ6MWtJUzVkeVR2akUwX3JxYUEzWWVBaDBiVVhVbXhXMTE=",
  },

  token: function (request) {
    var headers = new Headers();
    headers.append("Authorization", service.api.auth);
    headers.append("Content-Type", "application/x-www-form-urlencoded");

    var params = service.format({
      username: request.data.username,
      password: request.data.password,
      grant_type: "password",
      scope: "offline_access",
    });

    fetch(`${service.api.url}/auth/v1/token`, {
      method: "POST",
      headers: headers,
      body: params,
    })
      .then((response) => response.json())
      .then((json) => request.success && request.success(json))
      .catch((error) => {
        console.log(error);
        request.error && request.error(error);
      });
  },

  refresh: function (request) {
    var headers = new Headers();
    headers.append("Authorization", service.api.auth);
    headers.append("Content-Type", "application/x-www-form-urlencoded");

    var params = service.format({
      refresh_token: session.storage.refresh_token,
      grant_type: "refresh_token",
      scope: "offline_access",
    });

    fetch(`${service.api.url}/auth/v1/token`, {
      method: "POST",
      headers: headers,
      body: params,
    })
      .then((response) => response.json())
      .then((json) => request.success(json))
      .catch((error) => request.error(error));
  },

  profile: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        fetch(`${service.api.url}/accounts/v1/me/profile`, {
          headers: headers,
        })
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  profiles: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        fetch(`${service.api.url}/accounts/v1/me/multiprofile`, {
          headers: headers,
        })
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  setProfile: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/json");

        fetch(`${service.api.url}/accounts/v1/me/profile`, {
          method: "PATCH",
          headers: headers,
          body: JSON.stringify(request.data),
        })
          .then((response) => null)
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  switchProfile: function (request, profile_id) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", service.api.auth);
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        const params = service.format({
          refresh_token: storage.refresh_token,
          grant_type: "refresh_token_profile_id",
          profile_id,
          scope: "offline_access",
        });

        fetch(`${service.api.url}/auth/v1/token`, {
          method: "POST",
          headers: headers,
          body: params,
        })
          .then((response) => response.json())
          .then((json) => {
            return request.success(json);
          })
          .catch((error) => request.error(error));
      },
    });
  },

  cookies: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        fetch(`${service.api.url}/index/v2`, {
          headers: headers,
        })
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  home: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        fetch(
          `${service.api.url}/content/v2/discover/${storage.id}/home_feed?start=0&n=100&preferred_audio_language=${session.usableLanguage(
            storage.account && storage.account.audio,
            "en-US"
          )}&locale=${session.usableLanguage(storage.language, "en-US")}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error && request.error(error));
      },
      error: function (error) {
        request.error && request.error(error);
      },
    });
  },

  previous: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        fetch(
          `${service.api.url}/content/v2/discover/previous_episode/${request.data.ids}?locale=${storage.language}&preferred_audio_language=${storage.account.audio}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  continue: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        fetch(
          `${service.api.url}/content/v2/discover/up_next/${request.data.ids}?locale=${storage.language}&preferred_audio_language=${storage.account.audio}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  // Similar series for the detail row. The account-scoped route is only
  // used when the public discover route fails, including a 404.
  similar: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");
        var seriesId = encodeURIComponent(request.data.id);
        var n = request.data.n || 15;
        var query =
          "n=" +
          n +
          "&locale=" +
          storage.language +
          "&preferred_audio_language=" +
          storage.account.audio;
        var primary =
          service.api.url +
          "/content/v2/discover/similar_to/" +
          seriesId +
          "?" +
          query;
        var fallback =
          service.api.url +
          "/content/v2/discover/" +
          storage.id +
          "/similar_to/" +
          seriesId +
          "?" +
          query;

        var read = function (url) {
          return fetch(url, { headers: headers }).then(function (response) {
            if (!response.ok) {
              throw response.status;
            }
            return response.json();
          });
        };

        read(primary)
          .catch(function () {
            return read(fallback);
          })
          .then(function (json) {
            request.success && request.success(json);
          })
          .catch(function (error) {
            request.error && request.error(error);
          });
      },
    });
  },

  playheads: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        fetch(
          `${service.api.url}/content/v2/${storage.id}/playheads?content_ids=${request.data.ids}&preferred_audio_language=${storage.account.audio}&locale=${storage.language}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  seasons: function (request) {
    return session.cookies({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        fetch(
          `${service.api.url}/cms/v2${storage.cookies.bucket}/seasons?series_id=${request.data.id}&preferred_audio_language=${storage.account.audio}&locale=${storage.language}&Signature=${storage.cookies.signature}&Policy=${storage.cookies.policy}&Key-Pair-Id=${storage.cookies.key_pair_id}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
      error: function (error) {
        request.error(error);
      },
    });
  },

  episodes: function (request) {
    return session.cookies({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        fetch(
          `${service.api.url}/cms/v2${storage.cookies.bucket}/episodes?season_id=${request.data.id}&preferred_audio_language=${storage.account.audio}&locale=${storage.language}&Signature=${storage.cookies.signature}&Policy=${storage.cookies.policy}&Key-Pair-Id=${storage.cookies.key_pair_id}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
      error: function (error) {
        request.error(error);
      },
    });
  },

  video_v2: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");
        fetch(`${service.api.drm}/v1/${request.data.id}/tv/samsung/play`, {
          headers: headers,
        })
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  video: function (request) {
    return session.cookies({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        fetch(
          `${service.api.url}/cms/v2${storage.cookies.bucket}/videos/${request.data.id}/streams?Signature=${storage.cookies.signature}&Policy=${storage.cookies.policy}&Key-Pair-Id=${storage.cookies.key_pair_id}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
      error: function (error) {
        request.error(error);
      },
    });
  },

  // Same objects read the home shelves already use. `ratings=true` is the
  // query custom lists already send; it adds the audience `rating.average`.
  object: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");

        fetch(
          `${service.api.url}/content/v2/cms/objects/${encodeURIComponent(
            request.data
          )}?ratings=true&locale=${storage.language}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error && request.error(error));
      },
    });
  },

  search: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        var data = request.data || {};
        var type = "series,movie_listing";
        if (data.type === "series" || data.type === "movie_listing") {
          type = data.type;
        }
        var query = encodeURIComponent(data.query == null ? "" : String(data.query));
        var locale = encodeURIComponent(
          session.usableLanguage(storage && storage.language, "en-US")
        );
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");
        fetch(
          `${service.api.url}/content/v2/discover/search?q=${query}&type=${type}&n=100&locale=${locale}&ratings=true`,
          {
            headers: headers,
          }
        )
          .then(function (response) {
            if (!response.ok) {
              throw new Error("search failed");
            }
            return response.json();
          })
          .then(function (json) {
            request.success && request.success(json);
          })
          .catch(function (error) {
            request.error && request.error(error);
          });
      },
      error: function (error) {
        request.error && request.error(error);
      },
    });
  },

  // Recent watch history is one page of episodes, which is only a few
  // series. Follow the next page until the list stops or the cap hits.
  watchHistorySeries: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", "Bearer " + storage.access_token);
        var ids = {};
        var seen = {};
        var pages = 0;
        var load = function (url) {
          if (!url || seen[url] || pages >= 15) {
            request.success && request.success(ids);
            return;
          }
          seen[url] = true;
          pages++;
          fetch(url, { headers: headers })
            .then(function (response) {
              return response.json();
            })
            .then(function (json) {
              var rows = (json && json.data) || [];
              rows.forEach(function (row) {
                var meta = row.panel && row.panel.episode_metadata;
                var id = meta && meta.series_id;
                if (id) {
                  ids[String(id)] = true;
                }
              });
              var next = json && json.meta && json.meta.next_page;
              if (!next || !rows.length) {
                request.success && request.success(ids);
                return;
              }
              if (next.indexOf("http") === 0) {
                load(next);
              } else if (next.charAt(0) === "/") {
                load(service.api.url + next);
              } else {
                request.success && request.success(ids);
              }
            })
            .catch(function () {
              request.success && request.success(ids);
            });
        };
        var language = session.usableLanguage(
          storage.account && storage.account.language,
          "en-US"
        );
        var audio =
          (storage.account && storage.account.audio) || language;
        load(
          service.api.url +
            "/content/v2/" +
            storage.id +
            "/watch-history?page_size=100&preferred_audio_language=" +
            audio +
            "&locale=" +
            language
        );
      },
      error: function () {
        request.success && request.success({});
      },
    });
  },

  // Newest history row for this series. The season number on that row is
  // the season to mark. Stops at the first match, or after 15 pages.
  latestWatchedSeason: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", "Bearer " + storage.access_token);
        var seriesId = String((request && request.seriesId) || "");
        var seen = {};
        var pages = 0;
        var finish = function (seasonNumber) {
          request.success && request.success(seasonNumber);
        };
        var load = function (url) {
          if (!url || !seriesId || seen[url] || pages >= 15) {
            finish(null);
            return;
          }
          seen[url] = true;
          pages++;
          fetch(url, { headers: headers })
            .then(function (response) {
              return response.json();
            })
            .then(function (json) {
              var rows = (json && json.data) || [];
              for (var i = 0; i < rows.length; i++) {
                var meta = rows[i].panel && rows[i].panel.episode_metadata;
                if (!meta || String(meta.series_id) !== seriesId) {
                  continue;
                }
                var seasonNumber = Number(meta.season_number);
                finish(isFinite(seasonNumber) ? seasonNumber : null);
                return;
              }
              var next = json && json.meta && json.meta.next_page;
              if (!next || !rows.length) {
                finish(null);
                return;
              }
              if (next.indexOf("http") === 0) {
                load(next);
              } else if (next.charAt(0) === "/") {
                load(service.api.url + next);
              } else {
                finish(null);
              }
            })
            .catch(function () {
              finish(null);
            });
        };
        var language = session.usableLanguage(
          storage.account && storage.account.language,
          "en-US"
        );
        var audio = (storage.account && storage.account.audio) || language;
        load(
          service.api.url +
            "/content/v2/" +
            storage.id +
            "/watch-history?page_size=100&preferred_audio_language=" +
            audio +
            "&locale=" +
            language
        );
      },
      error: function () {
        request.success && request.success(null);
      },
    });
  },

  history: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");
        fetch(
          `${service.api.url}/content/v2/${storage.id}/watch-history?page_size=100&preferred_audio_language=${storage.account.audio}&locale=${storage.language}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  setHistory: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/json");
        fetch(
          `${service.api.url}/content/v2/${storage.id}/playheads?preferred_audio_language=${storage.account.audio}&locale=${storage.language}`,
          {
            method: "POST",
            headers: headers,
            body: JSON.stringify(request.data),
          }
        )
          .then((response) => response.text())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  languages: function (request) {
    fetch(
      `${service.api.static}/config/i18n/v3/${
        request.data.type === "subtitle"
          ? "timed_text_languages.json"
          : "audio_languages.json"
      }`
    )
      .then((response) => response.json())
      .then((json) => request.success(json))
      .catch((error) => request.error(error));
  },

  intro: function (request) {
    fetch(`${service.api.static}/skip-events/production/${request.data.id}.json`)
      .then((response) => response.json())
      .then((json) => request.success(json))
      .catch((error) => request.error(error));
  },

  categories: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/x-www-form-urlencoded");
        fetch(
          `${service.api.url}/content/v1/tenant_categories?include_subcategories=true&locale=${storage.language}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  // Genre browse and season browse. `ratings=true` adds the star average.
  browse: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        var data = request.data || {};
        var locale = encodeURIComponent(
          session.usableLanguage(storage && storage.language, "en-US")
        );
        var params = ["n=100", "ratings=true", "sort_by=popularity", "locale=" + locale];
        if (data.categories) {
          params.push("categories=" + encodeURIComponent(data.categories));
        }
        if (data.seasonalTag) {
          params.push("seasonal_tag=" + encodeURIComponent(data.seasonalTag));
        }
        headers.append("Authorization", "Bearer " + storage.access_token);
        headers.append("Content-Type", "application/x-www-form-urlencoded");
        fetch(service.api.url + "/content/v2/discover/browse?" + params.join("&"), {
          headers: headers,
        })
          .then(function (response) {
            if (!response.ok) {
              throw new Error("browse failed");
            }
            return response.json();
          })
          .then(function (json) {
            request.success && request.success(json);
          })
          .catch(function (error) {
            request.error && request.error(error);
          });
      },
      error: function (error) {
        request.error && request.error(error);
      },
    });
  },

  getCustomLists: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/json");
        fetch(
          `${service.api.url}/content/v2/${storage.id}/custom-lists?preferred_audio_language=${storage.account.audio}&locale=${storage.language}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  getCustomListItems: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/json");
        fetch(
          `${service.api.url}/content/v2/${storage.id}/custom-lists/${request.data}?ratings=true&preferred_audio_language=${storage.account.audio}&locale=${storage.language}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  getWatchList: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/json");
        fetch(
          `${service.api.url}/content/v2/discover/${storage.id}/watchlist?order=desc&n=1000&preferred_audio_language=${storage.account.audio}&locale=${storage.language}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  inWatchList: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/json");
        fetch(
          `${service.api.url}/content/v2/${storage.id}/watchlist?content_ids=${request.data}&preferred_audio_language=${storage.account.audio}&locale=${storage.language}`,
          {
            headers: headers,
          }
        )
          .then((response) => response.json())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  addWatchlist: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/json");
        fetch(
          `${service.api.url}/content/v2/${storage.id}/watchlist?preferred_audio_language=${storage.account.audio}&locale=${storage.language}`,
          {
            method: "POST",
            headers: headers,
            body: JSON.stringify(request.data),
          }
        )
          .then((response) => response.text())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  removeWatchlist: function (request) {
    return session.refresh({
      success: function (storage) {
        var headers = new Headers();
        headers.append("Authorization", `Bearer ${storage.access_token}`);
        headers.append("Content-Type", "application/json");
        fetch(
          `${service.api.url}/content/v2/${storage.id}/watchlist/${request.data.content_id}?preferred_audio_language=${storage.account.audio}&locale=${storage.language}`,
          {
            method: "DELETE",
            headers: headers,
          }
        )
          .then((response) => response.text())
          .then((json) => request.success(json))
          .catch((error) => request.error(error));
      },
    });
  },

  format: function (params) {
    return Object.keys(params)
      .map(function (k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
      })
      .join("&");
  },
};
