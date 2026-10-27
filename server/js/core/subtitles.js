window.subtitleOverlay = {
  script: "off",
  signsOn: true,
  events: [],
  sources: null,
  request: 0,
  root: null,
  anchors: {},
  nodes: [],
  activeKey: "",
  frame: null,
  layoutKey: "",
  rect: { left: 0, top: 0, width: 0, height: 0 },
  defaultRes: { x: 640, y: 360 },
  // Dialogue size as a fraction of the video height.
  sizes: { S: 0.034, M: 0.042, L: 0.05 },
  dialogueMargin: 0.08,
  prefDefaults: { size: "M", background: "none", shadow: "drop" },
  prefChoices: {
    size: ["S", "M", "L"],
    background: ["none", "semi", "solid"],
    shadow: ["drop", "none"],
  },
  activePrefs: null,

  // Subtitle look, persisted next to the dub subtitle mode in the session store.
  prefs: function () {
    var stored =
      (window.session && session.storage && session.storage.subtitleStyle) || {};
    var prefs = {};
    Object.keys(subtitleOverlay.prefDefaults).forEach(function (key) {
      prefs[key] =
        subtitleOverlay.prefChoices[key].indexOf(stored[key]) >= 0
          ? stored[key]
          : subtitleOverlay.prefDefaults[key];
    });
    return prefs;
  },

  setPref: function (key, value) {
    if (subtitleOverlay.prefChoices[key].indexOf(value) < 0) {
      return;
    }
    var prefs = subtitleOverlay.prefs();
    prefs[key] = value;
    session.storage.subtitleStyle = prefs;
    session.update();
    subtitleOverlay.activeKey = "";
  },

  // Loads the subtitle files a stream can use. The original-language version
  // carries the full English translation (dialogue and signs); the dub carries
  // its own closed captions.
  prepare: function (options) {
    var request = ++subtitleOverlay.request;
    var sources = {
      episodeId: options.episodeId,
      original: null,
      captions: null,
      ready: null,
    };
    subtitleOverlay.sources = sources;

    var originalId = subtitleOverlay.originalVersionId(options);
    var dubId = subtitleOverlay.dubVersionId(options);
    var loadOriginal = subtitleOverlay
      .playDataFor(originalId || options.episodeId, options)
      .then(function (data) {
        return subtitleOverlay.loadTrack(data, ["subtitles"]);
      });
    var loadCaptions = dubId
      ? subtitleOverlay.playDataFor(dubId, options).then(function (data) {
          return subtitleOverlay.loadTrack(data, ["captions", "subtitles"]);
        })
      : Promise.resolve(null);

    sources.ready = Promise.all([
      loadOriginal.catch(subtitleOverlay.logFailure("original")),
      loadCaptions.catch(subtitleOverlay.logFailure("captions")),
    ]).then(function (results) {
      if (request !== subtitleOverlay.request) {
        return null;
      }
      sources.original = results[0];
      sources.captions = results[1];
      return sources;
    });
    return sources.ready;
  },

  // script is "off", "sub", or "dub". Sign cards are always drawn.
  // Spoken lines still follow the script, so "off" draws cards only.
  // hideDupes drops a second copy of the same words.
  setTrack: function (script, hideDupes) {
    subtitleOverlay.script = script || "off";
    subtitleOverlay.hideDupes = !!hideDupes;
    subtitleOverlay.events = [];
    subtitleOverlay.clear();
    var request = subtitleOverlay.request;
    var chosenScript = subtitleOverlay.script;
    var chosenSigns = subtitleOverlay.hideDupes;
    var sources = subtitleOverlay.sources;
    if (!sources) {
      return;
    }
    sources.ready.then(function () {
      if (
        request !== subtitleOverlay.request ||
        chosenScript !== subtitleOverlay.script ||
        chosenSigns !== subtitleOverlay.hideDupes
      ) {
        return;
      }
      subtitleOverlay.events = subtitleOverlay.buildEvents(
        chosenScript,
        sources,
        chosenSigns
      );
      subtitleOverlay.startLoop();
    });
  },

  stop: function () {
    subtitleOverlay.request++;
    subtitleOverlay.sources = null;
    subtitleOverlay.script = "off";
    subtitleOverlay.signsOn = false;
    subtitleOverlay.events = [];
    subtitleOverlay.clear();
    subtitleOverlay.stopLoop();
  },

  signCues: function (track) {
    return ((track && track.events) || []).filter(function (event) {
      return !subtitleOverlay.isDialogue(event);
    });
  },

  // Dub captions only lend cues that are clearly signs (positioned or
  // sign-named), so offset dialogue captions are never doubled up.
  captionSignCues: function (track) {
    return ((track && track.events) || []).filter(function (event) {
      return (
        !!(event.pos || event.move) ||
        /sign|title|text|note|card|screen|insert|logo|eyecatch/.test(
          (event.styleName + " " + event.actor).toLowerCase()
        )
      );
    });
  },

  // What each mode can draw for the loaded files. The sub script (original
  // English translation) is the signs source; when it has no sign cues, any
  // positioned cues in the dub captions are appended to sub script mode.
  describe: function (sources) {
    var original = sources && sources.original;
    var captions = sources && sources.captions;
    var originalSigns = subtitleOverlay.signCues(original);
    var captionSigns = subtitleOverlay.captionSignCues(captions);
    var hasOriginal = !!(original && original.events.length);
    return {
      hasOriginal: hasOriginal,
      hasCaptions: !!(captions && captions.events.length),
      originalSigns: originalSigns.length,
      captionSigns: captionSigns.length,
      fullAddsSigns: hasOriginal && !originalSigns.length && captionSigns.length > 0,
    };
  },

  // Text of one cue, used to tell two cards apart.
  eventText: function (event) {
    var text = "";
    var segments = (event && event.segments) || [];
    for (var i = 0; i < segments.length; i++) {
      text += segments[i].text || "";
    }
    return text;
  },

  // Same cue object, or the same text for the same start and end. Style is
  // not part of the match, so two different cards in one style both stay.
  sameCard: function (a, b) {
    if (!a || !b) {
      return false;
    }
    if (a === b) {
      return true;
    }
    return (
      a.start === b.start &&
      a.end === b.end &&
      subtitleOverlay.eventText(a) === subtitleOverlay.eventText(b)
    );
  },

  // Second pass of sign cards. A card already in the active file is kept
  // once and the copy is dropped.
  appendSigns: function (events, signs) {
    var merged = (events || []).slice();
    var extras = signs || [];
    for (var i = 0; i < extras.length; i++) {
      var sign = extras[i];
      var duplicate = false;
      for (var j = 0; j < merged.length; j++) {
        if (subtitleOverlay.sameCard(merged[j], sign)) {
          duplicate = true;
          break;
        }
      }
      if (!duplicate) {
        merged.push(sign);
      }
    }
    return merged;
  },

  wordSet: function (event) {
    var text = subtitleOverlay.eventText(event).toLowerCase();
    var parts = text.split(/[^a-z0-9]+/);
    var words = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].length > 3) {
        words.push(parts[i]);
      }
    }
    return words;
  },

  // 1 when the lines are the same speech, 0 when they share no real words.
  textSimilarity: function (a, b) {
    var aw = subtitleOverlay.wordSet(a);
    var bw = subtitleOverlay.wordSet(b);
    if (!aw.length || !bw.length) {
      return subtitleOverlay.eventText(a).trim().toLowerCase() ===
        subtitleOverlay.eventText(b).trim().toLowerCase()
        ? 1
        : 0;
    }
    var set = {};
    for (var i = 0; i < bw.length; i++) {
      set[bw[i]] = true;
    }
    var shared = 0;
    for (var j = 0; j < aw.length; j++) {
      if (set[aw[j]]) {
        shared++;
      }
    }
    return shared / Math.min(aw.length, bw.length);
  },

  cueOverlap: function (a, b) {
    return b.start < a.end && a.start < b.end;
  },

  // A spoken line with no matching line in the other file is a sign reading
  // Crunchyroll stored as dialogue. Both files have to be loaded. A line that
  // merely sits in a gap, or that matches the other audio's speech, stays
  // spoken. lendUnmatched is only for the original English file: a lone line
  // there that overlaps different dub speech is the sign, and the dub line
  // stays dialogue.
  scriptOnlyReadings: function (from, other, lendUnmatched) {
    var events = (from && from.events) || [];
    var otherEvents = (other && other.events) || [];
    if (!events.length || !otherEvents.length) {
      return [];
    }
    var dialogue = [];
    var otherDialogue = [];
    for (var i = 0; i < events.length; i++) {
      if (subtitleOverlay.isDialogue(events[i])) {
        dialogue.push(events[i]);
      }
    }
    for (var j = 0; j < otherEvents.length; j++) {
      if (subtitleOverlay.isDialogue(otherEvents[j])) {
        otherDialogue.push(otherEvents[j]);
      }
    }
    var matchScore = function (event) {
      var best = 0;
      var covered = 0;
      var span = Math.max(0.001, event.end - event.start);
      for (var n = 0; n < otherDialogue.length; n++) {
        var cue = otherDialogue[n];
        if (!subtitleOverlay.cueOverlap(event, cue)) {
          continue;
        }
        var overlap = Math.min(event.end, cue.end) - Math.max(event.start, cue.start);
        if (overlap > 0) {
          covered += overlap;
        }
        var score = subtitleOverlay.textSimilarity(event, cue);
        if (score > best) {
          best = score;
        }
      }
      return { best: best, speech: covered > 0, coverage: covered / span };
    };
    var found = [];
    for (var e = 0; e < dialogue.length; e++) {
      var event = dialogue[e];
      if (event.signReading) {
        continue;
      }
      var match = matchScore(event);
      if (match.best >= 0.5) {
        continue;
      }
      var anyOverlap = false;
      for (var k = 0; k < otherEvents.length; k++) {
        if (subtitleOverlay.cueOverlap(event, otherEvents[k])) {
          anyOverlap = true;
          break;
        }
      }
      var hasSibling = false;
      var extra = false;
      for (var s = 0; s < dialogue.length; s++) {
        if (s === e || !subtitleOverlay.cueOverlap(event, dialogue[s])) {
          continue;
        }
        hasSibling = true;
        if (matchScore(dialogue[s]).best > match.best) {
          extra = true;
          break;
        }
      }
      // A caption that stays up longer than the other audio's speech is the
      // sign. A line that fills the same moment as different wording stays
      // spoken, or every loose dub translation would leave the bottom.
      var heldSign =
        lendUnmatched && match.speech && !hasSibling && match.coverage < 0.6;
      if (!anyOverlap || extra || heldSign) {
        found.push(event);
      }
    }
    return found;
  },

  // Lift a bottom dialogue cue into the sign band. A positioned cue keeps
  // its coordinates. The same object is shared by every script, so this
  // sticks for sub, dub, and subs-off.
  asSignReading: function (event) {
    event.signReading = true;
    if (!event.pos && !event.move && event.alignment <= 3) {
      event.alignment += 6;
    }
    return event;
  },

  plainText: function (event) {
    return subtitleOverlay.eventText(event).replace(/\s+/g, " ").trim().toLowerCase();
  },

  // Hide dupes is on: the same words at the same time keep one copy.
  // The sign copy stays. A spoken copy of those words is the extra.
  dropDuplicateTranslations: function (events) {
    var kept = [];
    (events || []).forEach(function (event) {
      var text = subtitleOverlay.plainText(event);
      if (!text) {
        kept.push(event);
        return;
      }
      var twin = -1;
      for (var i = 0; i < kept.length; i++) {
        if (
          subtitleOverlay.plainText(kept[i]) === text &&
          subtitleOverlay.cueOverlap(event, kept[i])
        ) {
          twin = i;
          break;
        }
      }
      if (twin < 0) {
        kept.push(event);
        return;
      }
      if (!subtitleOverlay.isDialogue(event) && subtitleOverlay.isDialogue(kept[twin])) {
        kept[twin] = event;
      }
    });
    return kept;
  },

  // Proper sign styles come from the original English file, and from the
  // dub captions when that file has none. A spoken line that only one
  // audio's file contains is a sign reading: it is shown for sub, dub,
  // and subs-off, up with the signs. hideDupes drops a second copy of the
  // same words. Spoken lines that both files cover stay with the script.
  buildEvents: function (script, sources, hideDupes) {
    sources = sources || {};
    var originalTrack = sources.original;
    var captionTrack = sources.captions;
    var original = (originalTrack && originalTrack.events) || [];
    var captions = (captionTrack && captionTrack.events) || [];
    var readings = subtitleOverlay
      .scriptOnlyReadings(originalTrack, captionTrack, true)
      .concat(subtitleOverlay.scriptOnlyReadings(captionTrack, originalTrack, false));
    for (var i = 0; i < readings.length; i++) {
      subtitleOverlay.asSignReading(readings[i]);
    }
    var signs = subtitleOverlay.signCues(originalTrack);
    var captionSigns = subtitleOverlay.captionSignCues(captionTrack);
    var captionReadings = captions.filter(function (event) {
      return event.signReading;
    });
    var sharedSigns = signs.concat(captionSigns).concat(captionReadings);
    var spoken;
    if (script === "sub") {
      spoken = original;
    } else if (script === "dub") {
      spoken = captions;
    } else {
      spoken = [];
    }
    var events = subtitleOverlay.appendSigns(
      spoken,
      signs.length ? sharedSigns : captionSigns.concat(captionReadings)
    );
    if (hideDupes) {
      events = subtitleOverlay.dropDuplicateTranslations(events);
    }
    return events.slice().sort(function (a, b) {
      return a.start - b.start || a.layer - b.layer;
    });
  },

  dubVersionId: function (options) {
    var versions = options.versions || [];
    var dubs = versions.filter(function (version) {
      return !version.original;
    });
    var english = dubs.filter(function (version) {
      return String(version.name || "").indexOf("en") === 0;
    })[0];
    if (english) {
      return english.id;
    }
    var current = dubs.filter(function (version) {
      return version.id === options.episodeId;
    })[0];
    if (current) {
      return current.id;
    }
    return dubs.length === 1 ? dubs[0].id : null;
  },

  playDataFor: function (id, options) {
    if (!id || id === options.episodeId) {
      return Promise.resolve(options.playData);
    }
    return subtitleOverlay.fetchPlayInfo(id);
  },

  loadTrack: function (data, groups) {
    var url = subtitleOverlay.pickUrl(data, groups);
    return url ? subtitleOverlay.load(url) : Promise.resolve(null);
  },

  originalVersionId: function (options) {
    var versions = options.versions || [];
    var original = versions.filter(function (version) {
      return version.original;
    })[0];
    if (!original) {
      original = versions.filter(function (version) {
        return String(version.name || "").indexOf("ja") === 0;
      })[0];
    }
    return original ? original.id : null;
  },

  fetchPlayInfo: function (id) {
    return new Promise(function (resolve, reject) {
      service.video_v2({
        data: { id: id },
        success: function (data) {
          if (data && data.token) {
            player.deleteSession({ data: { id: id, token: data.token } });
          }
          resolve(data);
        },
        error: reject,
      });
    });
  },

  pickUrl: function (data, groups) {
    if (!data) {
      return null;
    }
    for (var g = 0; g < groups.length; g++) {
      var group = data[groups[g]];
      if (!group) {
        continue;
      }
      var preferred = group["en-US"] || group["en"];
      if (preferred && preferred.url) {
        return preferred.url;
      }
      var keys = Object.keys(group);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf("en") === 0 && group[keys[i]] && group[keys[i]].url) {
          return group[keys[i]].url;
        }
      }
    }
    return null;
  },

  load: function (url) {
    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("subtitle http " + response.status);
        }
        return response.text();
      })
      .then(function (body) {
        return subtitleOverlay.parse(body);
      });
  },

  logFailure: function (label) {
    return function (error) {
      console.log("subtitle " + label + " load failed", error);
      return null;
    };
  },

  isDialogue: function (event) {
    if (event.signReading || event.pos || event.move || event.rotation) {
      return false;
    }
    var labels = (event.styleName + " " + event.actor).toLowerCase();
    if (
      /sign|title|text|note|card|screen|insert|song|lyric|kara|romaji|logo|eyecatch|preview|\bop\b|\bed\b/.test(
        labels
      )
    ) {
      return false;
    }
    // Crunchyroll puts on-screen cards on TopLeft / TopCenter / TopRight.
    // Those styles are alignment 8, which is also the top-center dialogue
    // slot, so the alignment check alone kept the cards glued to the sub script.
    var style = String(event.styleName || "").toLowerCase();
    if (style === "topleft" || style === "topcenter" || style === "topright") {
      return false;
    }
    return event.alignment === 2 || event.alignment === 8;
  },

  // ---------- parsing ----------

  parse: function (body) {
    var text = String(body || "").replace(/^\uFEFF/, "");
    if (text.indexOf("[Events]") >= 0 || text.indexOf("Dialogue:") >= 0) {
      return subtitleOverlay.parseAss(text);
    }
    return subtitleOverlay.parseVtt(text);
  },

  parseAss: function (body) {
    var lines = body.replace(/\r/g, "").split("\n");
    var section = "";
    var styleFormat = null;
    var eventFormat = null;
    var resX = 0;
    var resY = 0;
    var styles = {};
    var rawEvents = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.charAt(0) === ";") {
        continue;
      }
      if (line.charAt(0) === "[" && line.charAt(line.length - 1) === "]") {
        section = line.toLowerCase();
        continue;
      }
      var colon = line.indexOf(":");
      if (colon < 0) {
        continue;
      }
      var key = line.slice(0, colon).trim();
      var value = line.slice(colon + 1).trim();

      if (section === "[script info]") {
        if (key === "PlayResX") {
          resX = Number(value) || 0;
        } else if (key === "PlayResY") {
          resY = Number(value) || 0;
        }
      } else if (section === "[v4+ styles]" || section === "[v4 styles]") {
        if (key === "Format") {
          styleFormat = subtitleOverlay.formatFields(value);
        } else if (key === "Style" && styleFormat) {
          var style = subtitleOverlay.readStyle(
            subtitleOverlay.fields(value, styleFormat),
            section === "[v4 styles]"
          );
          styles[style.name] = style;
        }
      } else if (section === "[events]") {
        if (key === "Format") {
          eventFormat = subtitleOverlay.formatFields(value);
        } else if (key === "Dialogue" && eventFormat) {
          rawEvents.push(subtitleOverlay.fields(value, eventFormat));
        }
      }
    }

    if (!resX && !resY) {
      resX = 384;
      resY = 288;
    } else if (!resY) {
      resY = resX === 1280 ? 1024 : Math.round((resX * 3) / 4);
    } else if (!resX) {
      resX = Math.round((resY * 4) / 3);
    }
    var res = { x: resX, y: resY };
    var fallback = subtitleOverlay.defaultStyle(res);

    var events = [];
    for (var e = 0; e < rawEvents.length; e++) {
      var raw = rawEvents[e];
      var baseStyle =
        styles[raw.style] ||
        styles[String(raw.style || "").replace(/^\*/, "")] ||
        styles.Default ||
        fallback;
      var event = subtitleOverlay.buildEvent(raw, baseStyle, res, styles);
      if (event) {
        events.push(event);
      }
    }
    return { res: res, events: events };
  },

  formatFields: function (value) {
    return value.split(",").map(function (field) {
      return field.trim().toLowerCase();
    });
  },

  fields: function (value, format) {
    var parts = value.split(",");
    var result = {};
    for (var i = 0; i < format.length; i++) {
      result[format[i]] =
        i === format.length - 1
          ? parts.slice(i).join(",")
          : (parts[i] || "").trim();
    }
    return result;
  },

  readStyle: function (raw, legacy) {
    var alignment = Number(raw.alignment) || 2;
    if (legacy) {
      alignment = subtitleOverlay.legacyAlignment(alignment);
    }
    return {
      name: raw.name || "Default",
      font: raw.fontname || "Arial",
      size: Number(raw.fontsize) || 20,
      primary: subtitleOverlay.color(raw.primarycolour, "&H00FFFFFF"),
      outline: subtitleOverlay.color(raw.outlinecolour, "&H00000000"),
      back: subtitleOverlay.color(raw.backcolour, "&H80000000"),
      bold: raw.bold === "-1" || Number(raw.bold) > 0,
      italic: raw.italic === "-1" || raw.italic === "1",
      underline: raw.underline === "-1" || raw.underline === "1",
      strike: raw.strikeout === "-1" || raw.strikeout === "1",
      scaleX: Number(raw.scalex) || 100,
      scaleY: Number(raw.scaley) || 100,
      spacing: Number(raw.spacing) || 0,
      angle: Number(raw.angle) || 0,
      borderStyle: Number(raw.borderstyle) || 1,
      bord: raw.outline === undefined ? 2 : Number(raw.outline) || 0,
      shad: raw.shadow === undefined ? 0 : Number(raw.shadow) || 0,
      alignment: alignment,
      marginL: Number(raw.marginl) || 0,
      marginR: Number(raw.marginr) || 0,
      marginV: Number(raw.marginv) || 0,
    };
  },

  defaultStyle: function (res) {
    var scale = res.y / 360;
    return subtitleOverlay.readStyle({
      name: "Default",
      fontname: "Arial",
      fontsize: String(22 * scale),
      bold: "-1",
      outline: String(2 * scale),
      shadow: String(1 * scale),
      alignment: "2",
      marginl: String(30 * scale),
      marginr: String(30 * scale),
      marginv: String(18 * scale),
    });
  },

  legacyAlignment: function (value) {
    var horizontal = value & 3;
    var vertical = value & 12;
    var row = vertical === 4 ? 6 : vertical === 8 ? 3 : 0;
    return horizontal + row || 2;
  },

  color: function (value, fallback) {
    var hex = String(value || fallback)
      .replace(/&H/i, "")
      .replace(/&/g, "")
      .trim();
    if (!/^[0-9a-f]+$/i.test(hex)) {
      hex = String(fallback).replace(/&H/i, "");
    }
    while (hex.length < 8) {
      hex = "0" + hex;
    }
    hex = hex.slice(-8);
    return {
      a: 1 - parseInt(hex.slice(0, 2), 16) / 255,
      b: parseInt(hex.slice(2, 4), 16),
      g: parseInt(hex.slice(4, 6), 16),
      r: parseInt(hex.slice(6, 8), 16),
    };
  },

  buildEvent: function (raw, baseStyle, res, styles) {
    var event = {
      start: subtitleOverlay.parseTime(raw.start),
      end: subtitleOverlay.parseTime(raw.end),
      layer: Number(raw.layer) || 0,
      styleName: raw.style || "",
      actor: raw.name || raw.actor || "",
      res: res,
      style: baseStyle,
      alignment: baseStyle.alignment,
      marginL: Number(raw.marginl) || baseStyle.marginL,
      marginR: Number(raw.marginr) || baseStyle.marginR,
      marginV: Number(raw.marginv) || baseStyle.marginV,
      pos: null,
      move: null,
      fade: null,
      rotation: baseStyle.angle,
      segments: [],
    };
    if (!(event.end > event.start)) {
      return null;
    }

    var text = raw.text || "";
    var state = subtitleOverlay.segmentState(baseStyle);
    var drawing = false;
    var cursor = 0;
    var blockPattern = /\{([^}]*)\}/g;
    var match;

    var pushText = function (chunk) {
      if (!chunk || drawing) {
        return;
      }
      var cleaned = chunk
        .replace(/\\N/g, "\n")
        .replace(/\\n/g, " ")
        .replace(/\\h/g, "\u00a0");
      if (cleaned) {
        event.segments.push(Object.assign({ text: cleaned }, state));
      }
    };

    while ((match = blockPattern.exec(text))) {
      pushText(text.slice(cursor, match.index));
      cursor = match.index + match[0].length;
      var tags = subtitleOverlay.parseTags(match[1]);
      for (var t = 0; t < tags.length; t++) {
        drawing = subtitleOverlay.applyTag(tags[t], event, state, styles, drawing);
      }
    }
    pushText(text.slice(cursor));

    var hasText = event.segments.some(function (segment) {
      return segment.text.replace(/\s/g, "").length > 0;
    });
    return hasText ? event : null;
  },

  segmentState: function (style) {
    return {
      font: style.font,
      size: style.size,
      primary: style.primary,
      outline: style.outline,
      back: style.back,
      bold: style.bold,
      italic: style.italic,
      underline: style.underline,
      strike: style.strike,
      scaleX: style.scaleX,
      scaleY: style.scaleY,
      spacing: style.spacing,
      bord: style.bord,
      shad: style.shad,
      borderStyle: style.borderStyle,
      alpha: null,
    };
  },

  parseTags: function (block) {
    var tags = [];
    var pattern = /\\(\d?[a-zA-Z]+)(\([^)]*\)?|[^\\]*)/g;
    var match;
    while ((match = pattern.exec(block))) {
      var name = match[1];
      var arg = match[2] || "";
      if (name === "t") {
        continue;
      }
      tags.push({ name: name, arg: arg.trim() });
    }
    return tags;
  },

  args: function (arg) {
    return arg
      .replace(/^\(/, "")
      .replace(/\)$/, "")
      .split(",")
      .map(function (value) {
        return Number(value);
      });
  },

  applyTag: function (tag, event, state, styles, drawing) {
    var name = tag.name;
    var arg = tag.arg;
    var number = Number(arg);
    switch (name) {
      case "an":
        if (number >= 1 && number <= 9) {
          event.alignment = number;
        }
        break;
      case "a":
        if (number) {
          event.alignment = subtitleOverlay.legacyAlignment(number);
        }
        break;
      case "pos":
        var pos = subtitleOverlay.args(arg);
        if (pos.length >= 2 && !isNaN(pos[0]) && !isNaN(pos[1])) {
          event.pos = { x: pos[0], y: pos[1] };
        }
        break;
      case "move":
        var move = subtitleOverlay.args(arg);
        if (move.length >= 4) {
          event.move = {
            x1: move[0],
            y1: move[1],
            x2: move[2],
            y2: move[3],
            t1: move.length >= 6 ? move[4] : 0,
            t2: move.length >= 6 ? move[5] : 0,
          };
        }
        break;
      case "fad":
        var fad = subtitleOverlay.args(arg);
        if (fad.length >= 2) {
          event.fade = { fadeIn: fad[0], fadeOut: fad[1] };
        }
        break;
      case "fade":
        var fade = subtitleOverlay.args(arg);
        if (fade.length >= 7) {
          event.fade = { fadeIn: fade[4] - fade[3], fadeOut: fade[6] - fade[5] };
        }
        break;
      case "frz":
      case "fr":
        if (!isNaN(number)) {
          event.rotation = number;
        }
        break;
      case "p":
        return number > 0;
      case "b":
        state.bold = number === 1 || number >= 500;
        break;
      case "i":
        state.italic = number === 1;
        break;
      case "u":
        state.underline = number === 1;
        break;
      case "s":
        state.strike = number === 1;
        break;
      case "fn":
        if (arg) {
          state.font = arg;
        }
        break;
      case "fs":
        if (number > 0) {
          state.size = number;
        }
        break;
      case "fscx":
        if (!isNaN(number)) {
          state.scaleX = number;
        }
        break;
      case "fscy":
        if (!isNaN(number)) {
          state.scaleY = number;
        }
        break;
      case "fsp":
        if (!isNaN(number)) {
          state.spacing = number;
        }
        break;
      case "bord":
        if (!isNaN(number)) {
          state.bord = number;
        }
        break;
      case "shad":
        if (!isNaN(number)) {
          state.shad = number;
        }
        break;
      case "c":
      case "1c":
        // A bare \c restores the style color. Closed Caption Converter also
        // wraps title cards in {\c&H00000000&}text{\c}. That zero is not a
        // visible black: the outline is already black, so the card disappears.
        // A color such as &H000000FF still applies.
        if (!arg) {
          state.primary = subtitleOverlay.copyColor(event.style.primary);
        } else if (!/^&H0{8}&$/i.test(arg.replace(/\s/g, ""))) {
          state.primary = subtitleOverlay.mergeColor(state.primary, arg);
        }
        break;
      case "3c":
        state.outline = arg
          ? subtitleOverlay.mergeColor(state.outline, arg)
          : subtitleOverlay.copyColor(event.style.outline);
        break;
      case "4c":
        state.back = arg
          ? subtitleOverlay.mergeColor(state.back, arg)
          : subtitleOverlay.copyColor(event.style.back);
        break;
      case "alpha":
        state.alpha = subtitleOverlay.alphaValue(arg);
        break;
      case "1a":
        state.alpha = subtitleOverlay.alphaValue(arg);
        break;
      case "r":
        var reset = (arg && styles[arg]) || event.style;
        Object.assign(state, subtitleOverlay.segmentState(reset));
        break;
    }
    return drawing;
  },

  copyColor: function (color) {
    return { r: color.r, g: color.g, b: color.b, a: color.a };
  },

  mergeColor: function (current, arg) {
    if (!arg) {
      return current;
    }
    var parsed = subtitleOverlay.color("&H00" + arg.replace(/&H/i, "").replace(/&/g, "").slice(-6));
    parsed.a = current.a;
    return parsed;
  },

  alphaValue: function (arg) {
    var hex = String(arg || "")
      .replace(/&H/i, "")
      .replace(/&/g, "");
    var value = parseInt(hex, 16);
    return isNaN(value) ? null : 1 - value / 255;
  },

  parseTime: function (value) {
    var cleaned = String(value || "")
      .trim()
      .split(" ")[0]
      .replace(",", ".");
    var pieces = cleaned.split(":");
    if (pieces.length < 2) {
      return 0;
    }
    var hours = pieces.length === 3 ? Number(pieces[0]) : 0;
    var minutes = Number(pieces[pieces.length - 2]);
    var seconds = Number(pieces[pieces.length - 1]);
    return hours * 3600 + minutes * 60 + seconds;
  },

  parseVtt: function (body) {
    var res = subtitleOverlay.defaultRes;
    var style = subtitleOverlay.defaultStyle(res);
    var blocks = body.replace(/\r/g, "").split(/\n{2,}/);
    var events = [];
    for (var i = 0; i < blocks.length; i++) {
      var lines = blocks[i].split("\n");
      var timeIndex = -1;
      for (var l = 0; l < lines.length; l++) {
        if (lines[l].indexOf("-->") >= 0) {
          timeIndex = l;
          break;
        }
      }
      if (timeIndex < 0) {
        continue;
      }
      var timing = lines[timeIndex].split("-->");
      var endParts = timing[1].trim().split(/\s+/);
      var settings = endParts.slice(1).join(" ");
      var start = subtitleOverlay.parseTime(timing[0].replace(",", "."));
      var end = subtitleOverlay.parseTime(endParts[0].replace(",", "."));
      var text = lines.slice(timeIndex + 1).join("\n");
      var event = {
        start: start,
        end: end,
        layer: 0,
        styleName: "Captions",
        actor: "",
        res: res,
        style: style,
        alignment: subtitleOverlay.vttAlignment(settings),
        marginL: style.marginL,
        marginR: style.marginR,
        marginV: style.marginV,
        pos: null,
        move: null,
        fade: null,
        rotation: 0,
        segments: subtitleOverlay.vttSegments(text, style),
      };
      if (event.end > event.start && event.segments.length) {
        events.push(event);
      }
    }
    return { res: res, events: events };
  },

  vttAlignment: function (settings) {
    var line = /line:(-?[\d.]+)(%?)/.exec(settings || "");
    if (line) {
      var value = Number(line[1]);
      var top = line[2] ? value < 50 : value >= 0 && value < 8;
      if (top) {
        return 8;
      }
    }
    return 2;
  },

  vttSegments: function (text, style) {
    var segments = [];
    var state = subtitleOverlay.segmentState(style);
    var parts = text.split(/(<\/?[a-z][^>]*>)/i);
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) {
        continue;
      }
      var tag = /^<(\/?)([a-z]+)/i.exec(part);
      if (tag) {
        var on = tag[1] !== "/";
        var name = tag[2].toLowerCase();
        if (name === "i") {
          state.italic = on;
        } else if (name === "b") {
          state.bold = on;
        } else if (name === "u") {
          state.underline = on;
        }
        continue;
      }
      var cleaned = part
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, "\u00a0");
      if (cleaned.trim()) {
        segments.push(Object.assign({ text: cleaned }, state));
      }
    }
    return segments;
  },

  // ---------- rendering ----------

  startLoop: function () {
    if (subtitleOverlay.frame) {
      return;
    }
    var tick = function () {
      subtitleOverlay.frame = requestAnimationFrame(tick);
      var videoEl = document.getElementById("videoplayer");
      if (videoEl) {
        subtitleOverlay.render(videoEl.currentTime || 0);
      }
    };
    subtitleOverlay.frame = requestAnimationFrame(tick);
  },

  stopLoop: function () {
    if (subtitleOverlay.frame) {
      cancelAnimationFrame(subtitleOverlay.frame);
      subtitleOverlay.frame = null;
    }
  },

  ensureRoot: function () {
    var root = document.getElementById("subtitle-overlay");
    if (!root) {
      subtitleOverlay.root = null;
      return null;
    }
    if (root !== subtitleOverlay.root) {
      subtitleOverlay.root = root;
      subtitleOverlay.anchors = {};
      subtitleOverlay.nodes = [];
      subtitleOverlay.activeKey = "";
      subtitleOverlay.layoutKey = "";
      root.innerHTML = "";
    }
    return root;
  },

  clear: function () {
    var root = subtitleOverlay.ensureRoot();
    subtitleOverlay.activeKey = "";
    subtitleOverlay.nodes = [];
    subtitleOverlay.anchors = {};
    if (root) {
      root.innerHTML = "";
    }
  },

  updateLayout: function () {
    var videoEl = document.getElementById("videoplayer");
    var root = subtitleOverlay.root;
    if (!videoEl || !root || !root.parentNode) {
      return false;
    }
    var box = videoEl.getBoundingClientRect();
    var parentBox = root.parentNode.getBoundingClientRect();
    var fit = window.getComputedStyle(videoEl).objectFit || "contain";
    var picture = subtitleOverlay.pictureRect(
      box.width,
      box.height,
      videoEl.videoWidth,
      videoEl.videoHeight,
      fit
    );
    var width = picture.width;
    var height = picture.height;
    var left = box.left - parentBox.left + picture.left;
    var top = box.top - parentBox.top + picture.top;
    var key = [left, top, width, height].map(Math.round).join("x");
    if (key === subtitleOverlay.layoutKey) {
      return false;
    }
    subtitleOverlay.layoutKey = key;
    subtitleOverlay.rect = { left: left, top: top, width: width, height: height };
    root.style.left = left + "px";
    root.style.top = top + "px";
    root.style.width = width + "px";
    root.style.height = height + "px";
    return true;
  },

  render: function (time) {
    var root = subtitleOverlay.ensureRoot();
    if (!root) {
      return;
    }
    var layoutChanged = subtitleOverlay.updateLayout();
    var events = subtitleOverlay.events;
    var active = [];
    var key = "";
    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      if (event.start > time) {
        break;
      }
      if (time < event.end) {
        active.push(event);
        key += i + ",";
      }
    }
    if (key !== subtitleOverlay.activeKey || layoutChanged) {
      subtitleOverlay.activeKey = key;
      subtitleOverlay.draw(active);
    }
    subtitleOverlay.animate(time);
  },

  draw: function (active) {
    var root = subtitleOverlay.root;
    root.innerHTML = "";
    subtitleOverlay.anchors = {};
    subtitleOverlay.nodes = [];
    var prefs = subtitleOverlay.prefs();
    subtitleOverlay.activePrefs = prefs;
    root.className = "bg-" + prefs.background + " shadow-" + prefs.shadow;
    var dialogueActive = active.some(subtitleOverlay.isDialogue);
    for (var i = 0; i < active.length; i++) {
      var event = active[i];
      var dialogue = subtitleOverlay.isDialogue(event);
      var node = dialogue
        ? subtitleOverlay.dialogueNode(event)
        : subtitleOverlay.eventNode(event);
      if (!dialogue && (event.pos || event.move)) {
        root.appendChild(node);
      } else {
        subtitleOverlay.anchor(event, dialogue, dialogueActive).appendChild(node);
      }
      subtitleOverlay.nodes.push({ event: event, node: node });
    }
  },

  // Dialogue uses one house style (white sans, drop shadow, bottom safe
  // margin); only italics carry over from the source.
  dialogueNode: function (event) {
    var prefs = subtitleOverlay.activePrefs || subtitleOverlay.prefDefaults;
    var node = document.createElement("div");
    node.className = "subtitle-event subtitle-dialogue";
    node.style.fontSize =
      subtitleOverlay.rect.height * subtitleOverlay.sizes[prefs.size] + "px";
    for (var i = 0; i < event.segments.length; i++) {
      var span = document.createElement("span");
      span.textContent = event.segments[i].text;
      if (event.segments[i].italic) {
        span.style.fontStyle = "italic";
      }
      node.appendChild(span);
    }
    return node;
  },

  scale: function (event) {
    var rect = subtitleOverlay.rect;
    return {
      x: rect.width / event.res.x,
      y: rect.height / event.res.y,
    };
  },

  // object-fit contain/cover picture inside the video element box.
  // Offsets are from the element's top-left. fill uses the whole element.
  pictureRect: function (boxWidth, boxHeight, videoWidth, videoHeight, fit) {
    var width = boxWidth;
    var height = boxHeight;
    var naturalW = videoWidth || 16;
    var naturalH = videoHeight || 9;
    if (fit === "contain" || fit === "cover") {
      var ratio = naturalW / naturalH;
      var boxRatio = boxWidth / boxHeight;
      var widthLimited = fit === "contain" ? ratio > boxRatio : ratio < boxRatio;
      if (widthLimited) {
        height = boxWidth / ratio;
      } else {
        width = boxHeight * ratio;
      }
    }
    return {
      left: (boxWidth - width) / 2,
      top: (boxHeight - height) / 2,
      width: width,
      height: height,
    };
  },

  // Signs that share an alignment still have their own margin box. Middle
  // alignment ignores MarginV, matching ASS. Dialogue keeps one house box.
  anchorKey: function (event, dialogue, alignment) {
    var key =
      (dialogue ? "d" : "s") + alignment + ":" + event.res.x + "x" + event.res.y;
    if (!dialogue) {
      var middle = alignment > 3 && alignment <= 6;
      key +=
        ":" +
        event.marginL +
        ":" +
        event.marginR +
        ":" +
        (middle ? 0 : event.marginV);
    }
    return key;
  },

  // Line box for a cue with no \pos or \move. Left/right margins inset the
  // picture; alignment pins or centers the text inside that box. MarginV is
  // the distance from the top or bottom of the picture.
  anchorInsets: function (event, alignment, rect, dialogue) {
    var scaleX = rect.width / event.res.x;
    var scaleY = rect.height / event.res.y;
    var column = (alignment - 1) % 3;
    var row = alignment <= 3 ? "bottom" : alignment <= 6 ? "middle" : "top";
    var left = dialogue ? rect.width * 0.05 : event.marginL * scaleX;
    var right = dialogue ? rect.width * 0.05 : event.marginR * scaleX;
    var edgeY = dialogue
      ? rect.height * subtitleOverlay.dialogueMargin
      : event.marginV * scaleY;
    return {
      left: left,
      width: Math.max(0, rect.width - left - right),
      row: row,
      column: column,
      edgeY: edgeY,
    };
  },

  anchor: function (event, dialogue, dialogueActive) {
    var alignment = event.alignment;
    // A bottom sign would sit on top of dialogue; move it to the top band.
    if (!dialogue && dialogueActive && alignment <= 3) {
      alignment += 6;
    }
    var key = subtitleOverlay.anchorKey(event, dialogue, alignment);
    var existing = subtitleOverlay.anchors[key];
    if (existing) {
      return existing;
    }
    var rect = subtitleOverlay.rect;
    var box = subtitleOverlay.anchorInsets(event, alignment, rect, dialogue);
    var container = document.createElement("div");
    container.className = "subtitle-anchor";
    var style = container.style;
    style.left = box.left + "px";
    style.width = box.width + "px";
    style.alignItems = ["flex-start", "center", "flex-end"][box.column];
    style.textAlign = ["left", "center", "right"][box.column];
    if (box.row === "bottom") {
      style.bottom = box.edgeY + "px";
      style.flexDirection = "column-reverse";
    } else if (box.row === "top") {
      style.top = box.edgeY + "px";
      style.flexDirection = "column";
    } else {
      style.top = "50%";
      style.transform = "translateY(-50%)";
      style.flexDirection = "column";
    }
    subtitleOverlay.root.appendChild(container);
    subtitleOverlay.anchors[key] = container;
    return container;
  },

  eventNode: function (event) {
    var scale = subtitleOverlay.scale(event);
    var node = document.createElement("div");
    node.className = "subtitle-event";
    var column = (event.alignment - 1) % 3;
    node.style.textAlign = ["left", "center", "right"][column];

    for (var i = 0; i < event.segments.length; i++) {
      node.appendChild(subtitleOverlay.segmentNode(event.segments[i], scale));
    }

    if (event.pos || event.move) {
      var row = event.alignment <= 3 ? 100 : event.alignment <= 6 ? 50 : 0;
      var shift = [0, 50, 100][column];
      node.style.position = "absolute";
      node.style.whiteSpace = "pre";
      node.style.transformOrigin = "0 0";
      node.style.transform =
        "rotate(" + -event.rotation + "deg) translate(-" + shift + "%, -" + row + "%)";
      subtitleOverlay.place(node, event, scale, null);
    } else {
      node.style.width = "100%";
      node.style.maxWidth = "100%";
      if (event.rotation) {
        node.style.transform = "rotate(" + -event.rotation + "deg)";
      }
    }
    return node;
  },

  segmentNode: function (segment, scale) {
    var span = document.createElement("span");
    span.textContent = segment.text;
    var style = span.style;
    var fontSize = segment.size * scale.y * 0.88;
    var alpha = segment.alpha === null ? segment.primary.a : segment.alpha;
    style.fontFamily = '"' + segment.font + '", "Trebuchet MS", Arial, sans-serif';
    style.fontSize = fontSize + "px";
    style.fontWeight = segment.bold ? "700" : "400";
    style.fontStyle = segment.italic ? "italic" : "normal";
    style.color = subtitleOverlay.css(segment.primary, alpha);
    var decorations = [];
    if (segment.underline) {
      decorations.push("underline");
    }
    if (segment.strike) {
      decorations.push("line-through");
    }
    style.textDecoration = decorations.join(" ") || "none";
    if (segment.spacing) {
      style.letterSpacing = segment.spacing * scale.x + "px";
    }
    if (segment.scaleX !== 100 || segment.scaleY !== 100) {
      style.display = "inline-block";
      style.transform =
        "scale(" + segment.scaleX / 100 + "," + segment.scaleY / 100 + ")";
    }

    var outline = segment.bord * scale.y;
    var shadow = segment.shad * scale.y;
    if (segment.borderStyle === 3) {
      style.backgroundColor = subtitleOverlay.css(segment.outline, segment.outline.a);
      style.boxDecorationBreak = "clone";
      style.webkitBoxDecorationBreak = "clone";
      var bleed = Math.max(outline, fontSize * 0.16);
      style.padding = bleed * 0.45 + "px " + bleed + "px";
      style.borderRadius = Math.max(2, bleed * 0.2) + "px";
      if (shadow) {
        style.boxShadow =
          shadow + "px " + shadow + "px 0 " + subtitleOverlay.css(segment.back, segment.back.a);
      }
    } else {
      var shadows = [];
      if (outline > 0) {
        var outlineColor = subtitleOverlay.css(segment.outline, segment.outline.a);
        // A single ring of shadows is a thin perimeter. The stroke sits
        // under the fill, and a ring at each pixel of the width fills the
        // gap so a sign reads as a solid black bleed.
        style.webkitTextStroke = outline + "px " + outlineColor;
        style.paintOrder = "stroke fill";
        var rings = Math.min(10, Math.max(1, Math.ceil(outline)));
        for (var r = 1; r <= rings; r++) {
          for (var s = 0; s < 16; s++) {
            var angle = (2 * Math.PI * s) / 16;
            shadows.push(
              (Math.cos(angle) * r).toFixed(2) +
                "px " +
                (Math.sin(angle) * r).toFixed(2) +
                "px 0 " +
                outlineColor
            );
          }
        }
      }
      if (shadow > 0) {
        shadows.push(
          shadow + "px " + shadow + "px 0 " + subtitleOverlay.css(segment.back, segment.back.a)
        );
      }
      style.textShadow = shadows.join(",") || "none";
    }
    return span;
  },

  css: function (color, alpha) {
    var a = alpha === null || alpha === undefined ? color.a : alpha;
    return "rgba(" + color.r + "," + color.g + "," + color.b + "," + a.toFixed(3) + ")";
  },

  place: function (node, event, scale, time) {
    var x;
    var y;
    if (event.move) {
      var move = event.move;
      var progress = 0;
      if (time !== null) {
        var elapsed = (time - event.start) * 1000;
        var t1 = move.t1;
        var t2 = move.t2 || (event.end - event.start) * 1000;
        progress = elapsed <= t1 ? 0 : elapsed >= t2 ? 1 : (elapsed - t1) / (t2 - t1 || 1);
      }
      x = move.x1 + (move.x2 - move.x1) * progress;
      y = move.y1 + (move.y2 - move.y1) * progress;
    } else {
      x = event.pos.x;
      y = event.pos.y;
    }
    node.style.left = x * scale.x + "px";
    node.style.top = y * scale.y + "px";
  },

  animate: function (time) {
    var nodes = subtitleOverlay.nodes;
    for (var i = 0; i < nodes.length; i++) {
      var event = nodes[i].event;
      var node = nodes[i].node;
      if (event.move) {
        subtitleOverlay.place(node, event, subtitleOverlay.scale(event), time);
      }
      if (event.fade) {
        var elapsed = (time - event.start) * 1000;
        var remaining = (event.end - time) * 1000;
        var opacity = 1;
        if (event.fade.fadeIn > 0 && elapsed < event.fade.fadeIn) {
          opacity = Math.max(0, elapsed / event.fade.fadeIn);
        } else if (event.fade.fadeOut > 0 && remaining < event.fade.fadeOut) {
          opacity = Math.max(0, remaining / event.fade.fadeOut);
        }
        node.style.opacity = opacity.toFixed(3);
      }
    }
  },
};
