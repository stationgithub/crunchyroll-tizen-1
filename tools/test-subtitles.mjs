// Parser checks for server/js/core/subtitles.js: node tools/test-subtitles.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";

const context = { window: {}, console };
context.window = context;
vm.createContext(context);
vm.runInContext(readFileSync("server/js/core/subtitles.js", "utf8"), context);
const overlay = context.subtitleOverlay;
const plain = (value) => JSON.parse(JSON.stringify(value));

const parsed = overlay.parse(readFileSync("tools/fixtures/sample.ass", "utf8"));
assert.deepEqual({ ...parsed.res }, { x: 640, y: 360 });
assert.equal(parsed.events.length, 7, "drawing-only event is dropped");

const byText = (text) =>
  parsed.events.find((event) => event.segments.map((s) => s.text).join("") === text);

const konbini = byText("Konbini");
assert.deepEqual({ ...konbini.pos }, { x: 500, y: 120 });
assert.equal(konbini.alignment, 5);
assert.equal(konbini.rotation, 12);
assert.deepEqual(
  { r: konbini.segments[0].primary.r, g: konbini.segments[0].primary.g, b: konbini.segments[0].primary.b },
  { r: 0xe0, g: 0x20, b: 0x20 }
);

assert.equal(byText("Class 2-B").fade.fadeIn, 300);
assert.equal(byText("Breaking news").move.x2, 540);
assert.equal(byText("Breaking news").segments[0].size, 14);
assert.equal(byText("Line one\nLine two").segments.length, 1);

const overlap = byText("Nowhere, apparently.");
assert.equal(overlap.segments[0].italic, true);
assert.equal(overlap.segments[1].italic, false);

const dialogue = parsed.events.filter((event) => overlay.isDialogue(event)).map((event) => event.actor || event.styleName);
assert.deepEqual(plain(dialogue), ["Hero", "Rival", "Default"]);
const captions = overlay.parse(
  "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:02.00,Captions,,0,0,0,,Hello"
);
assert.equal(overlay.isDialogue(captions.events[0]), true);

const signs = overlay.buildEvents("off", { original: parsed, captions: null }, true);
assert.deepEqual(
  plain(signs.map((event) => event.segments.map((s) => s.text).join(""))),
  ["Konbini", "Class 2-B", "Breaking news", "Running through the night"]
);

const vtt = overlay.parse(
  "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.500 line:10%\n<i>Hey</i> there\n\n2\n00:00:04.000 --> 00:00:05.000\nBye"
);
assert.equal(vtt.events.length, 2);
assert.equal(vtt.events[0].alignment, 8);
assert.equal(vtt.events[0].segments[0].italic, true);
assert.equal(vtt.events[1].end, 5);

const cc = overlay.buildEvents("dub", { original: parsed, captions: vtt }, true);
assert.equal(cc.length, 6);

const withSigns = overlay.describe({ original: parsed, captions: vtt });
assert.equal(withSigns.originalSigns, 4);
assert.equal(withSigns.fullAddsSigns, false);
assert.equal(overlay.buildEvents("sub", { original: parsed, captions: vtt }, true).length, 7);

const header =
  "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";
const dialogueOnly = overlay.parse(
  header + "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Just talking"
);
const signedCaptions = overlay.parse(
  header +
    "Dialogue: 0,0:00:01.00,0:00:02.00,Captions,,0,0,0,,Hello\n" +
    "Dialogue: 0,0:00:01.00,0:00:02.00,Captions,,0,0,0,,{\\an7}Offset caption\n" +
    "Dialogue: 0,0:00:03.00,0:00:04.00,Captions,,0,0,0,,{\\pos(100,50)}Shop sign"
);
const merged = overlay.describe({ original: dialogueOnly, captions: signedCaptions });
assert.equal(merged.originalSigns, 0);
assert.equal(merged.captionSigns, 1, "offset dialogue captions are not lent as signs");
assert.equal(merged.fullAddsSigns, true);
assert.deepEqual(
  plain(
    overlay
      .buildEvents("sub", { original: dialogueOnly, captions: signedCaptions }, true)
      .map((event) => event.segments.map((s) => s.text).join(""))
  ),
  ["Just talking", "Shop sign"]
);
assert.deepEqual(
  plain(
    overlay
      .buildEvents("off", { original: dialogueOnly, captions: signedCaptions }, true)
      .map((event) => event.segments.map((s) => s.text).join(""))
  ),
  ["Shop sign"]
);
assert.deepEqual(
  plain(
    overlay
      .buildEvents("dub", { original: dialogueOnly, captions: signedCaptions }, false)
      .map((event) => event.segments.map((s) => s.text).join(""))
  ),
  ["Hello", "Offset caption", "Shop sign"]
);
assert.equal(overlay.buildEvents("off", { original: null, captions: signedCaptions }, false).length, 1);

const missing = overlay.describe({ original: null, captions: signedCaptions });
assert.equal(missing.hasOriginal, false);
assert.equal(missing.fullAddsSigns, false);
assert.equal(overlay.buildEvents("off", { original: null, captions: signedCaptions }, true).length, 1);

const margins = overlay.parse(readFileSync("tools/fixtures/margins.ass", "utf8"));
const marginCue = (text) =>
  margins.events.find((event) => event.segments.map((s) => s.text).join("") === text);
const rightSide = marginCue("Right side");
const leftSide = marginCue("Left side");
const styleMargins = marginCue("Style margins");
const middleHigh = marginCue("Middle high");
const middleLow = marginCue("Middle low");
const placed = marginCue("Placed");

assert.equal(margins.res.x, 640);
assert.equal(margins.res.y, 360);
assert.equal(rightSide.alignment, 8, "\\an overrides the style alignment");
assert.equal(rightSide.pos, null);
assert.equal(rightSide.marginL, 420);
assert.equal(rightSide.marginR, 20);
assert.equal(rightSide.marginV, 30);
assert.equal(leftSide.marginL, 20);
assert.equal(leftSide.marginR, 400);
assert.equal(styleMargins.pos, null);
assert.equal(styleMargins.alignment, 7);
assert.equal(styleMargins.marginL, 10, "event margin 0 keeps the style margin");
assert.equal(styleMargins.marginR, 10);
assert.equal(styleMargins.marginV, 10);
assert.deepEqual({ ...placed.pos }, { x: 100, y: 80 });

assert.notEqual(
  overlay.anchorKey(rightSide, false, rightSide.alignment),
  overlay.anchorKey(leftSide, false, leftSide.alignment),
  "different margin boxes do not share an anchor"
);
assert.equal(
  overlay.anchorKey(middleHigh, false, middleHigh.alignment),
  overlay.anchorKey(middleLow, false, middleLow.alignment),
  "middle alignment ignores MarginV"
);
const house = { res: { x: 640, y: 360 }, marginL: 10, marginR: 80, marginV: 20 };
const otherHouse = { res: { x: 640, y: 360 }, marginL: 40, marginR: 10, marginV: 80 };
assert.equal(overlay.anchorKey(house, true, 2), overlay.anchorKey(otherHouse, true, 2));

const picture = overlay.pictureRect(1920, 1200, 1920, 1080, "contain");
assert.equal(picture.top, 60);
assert.equal(picture.height, 1080);
assert.equal(picture.width, 1920);
assert.equal(picture.left, 0);
const fitted = { width: picture.width, height: picture.height };
const rightBox = overlay.anchorInsets(rightSide, 8, fitted, false);
assert.equal(rightBox.row, "top");
assert.equal(rightBox.column, 1);
assert.equal(rightBox.left, 420 * 3);
assert.equal(rightBox.edgeY, 30 * 3);
assert.equal(rightBox.width, 1920 - 420 * 3 - 20 * 3);
const leftBox = overlay.anchorInsets(leftSide, 8, fitted, false);
assert.equal(leftBox.left, 20 * 3);
assert.equal(leftBox.width, 1920 - 20 * 3 - 400 * 3);
const topLeft = overlay.anchorInsets(styleMargins, 7, fitted, false);
assert.equal(topLeft.column, 0);
assert.equal(topLeft.left, 10 * 3);
assert.equal(topLeft.edgeY, 10 * 3);
assert.equal(overlay.anchorInsets(middleHigh, 5, fitted, false).row, "middle");

const pillar = overlay.pictureRect(1920, 1080, 1440, 1080, "contain");
assert.equal(pillar.left, 240);
assert.equal(pillar.width, 1440);
assert.equal(pillar.top, 0);
const cover = overlay.pictureRect(1920, 1200, 1920, 1080, "cover");
assert.equal(cover.height, 1200);
assert.ok(cover.left < 0);
assert.ok(Math.abs(cover.width - (1200 * 16) / 9) < 1e-6);
const filled = overlay.pictureRect(1920, 1200, 1920, 1080, "fill");
assert.equal(filled.top, 0);
assert.equal(filled.height, 1200);

const placedHeader =
  "[Script Info]\nPlayResX: 640\nPlayResY: 360\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: BottomCenter,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\nStyle: TopCenter,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,8,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";
const placedTrack = overlay.parse(
  placedHeader +
    "Dialogue: 0,0:00:01.00,0:00:02.00,BottomCenter,,0,0,0,,Hello there\n" +
    "Dialogue: 0,0:00:01.00,0:00:02.00,TopCenter,,0,0,0,,Fukuzawa\\NYukichi"
);
const placedText = (event) => event.segments.map((segment) => segment.text).join("");
assert.equal(placedTrack.events.length, 2);
assert.equal(overlay.isDialogue(placedTrack.events.find((event) => placedText(event) === "Hello there")), true);
assert.equal(
  overlay.isDialogue(placedTrack.events.find((event) => placedText(event).includes("Fukuzawa"))),
  false,
  "TopCenter cards are signs, not dialogue"
);
const placedSources = { original: placedTrack, captions: null };
assert.equal(
  overlay.buildEvents("sub", placedSources, false).length,
  2,
  "a TopCenter card already in the sub file is not drawn a second time"
);
assert.deepEqual(
  plain(overlay.buildEvents("sub", placedSources, false).map(placedText).sort()),
  ["Fukuzawa\nYukichi", "Hello there"]
);
assert.deepEqual(
  plain(overlay.buildEvents("sub", placedSources, true).map(placedText).sort()),
  ["Fukuzawa\nYukichi", "Hello there"]
);
assert.deepEqual(
  plain(overlay.buildEvents("dub", placedSources, true).map(placedText)),
  ["Fukuzawa\nYukichi"]
);
assert.deepEqual(
  plain(overlay.buildEvents("dub", placedSources, false).map(placedText)),
  ["Fukuzawa\nYukichi"]
);
assert.deepEqual(
  plain(overlay.buildEvents("off", placedSources, true).map(placedText)),
  ["Fukuzawa\nYukichi"]
);
assert.deepEqual(
  plain(overlay.buildEvents("off", placedSources, false).map(placedText)),
  ["Fukuzawa\nYukichi"],
  "Signs Off still draws the card and still hides spoken lines"
);

const resetTrack = overlay.parse(
  placedHeader +
    "Dialogue: 0,0:00:01.00,0:00:03.00,BottomCenter,,0,0,0,,Hello there\n" +
    "Dialogue: 0,0:00:01.00,0:00:03.00,TopCenter,,0,0,0,,{\\c&H00000000&}The{\\c}\\N{\\c&H00000000&}angels{\\c}\n" +
    "Dialogue: 0,0:00:04.00,0:00:06.00,TopCenter,,0,0,0,,{\\c&H000000FF&}Episode title{\\c}"
);
const resetText = (event) => event.segments.map((segment) => segment.text).join("");
const angels = resetTrack.events.find((event) => resetText(event).includes("angels"));
const episodeTitle = resetTrack.events.find((event) => resetText(event).includes("Episode"));
const spoken = resetTrack.events.find((event) => resetText(event) === "Hello there");
assert.equal(overlay.isDialogue(angels), false);
assert.equal(overlay.isDialogue(episodeTitle), false);
assert.equal(overlay.isDialogue(spoken), true);
for (const segment of angels.segments) {
  if (!segment.text.trim()) continue;
  assert.deepEqual(
    { r: segment.primary.r, g: segment.primary.g, b: segment.primary.b },
    { r: 255, g: 255, b: 255 },
    "zero-color title cards stay the style color"
  );
}
assert.deepEqual(
  {
    r: episodeTitle.segments[0].primary.r,
    g: episodeTitle.segments[0].primary.g,
    b: episodeTitle.segments[0].primary.b,
  },
  { r: 255, g: 0, b: 0 },
  "a real primary color override is kept"
);
const resetSources = { original: resetTrack, captions: vtt };
assert.deepEqual(
  plain(overlay.buildEvents("sub", resetSources, false).map(resetText).sort()),
  ["Episode title", "Hello there", "The\nangels"]
);
assert.deepEqual(
  plain(overlay.buildEvents("sub", resetSources, true).map(resetText).sort()),
  ["Episode title", "Hello there", "The\nangels"]
);
assert.deepEqual(
  plain(overlay.buildEvents("dub", resetSources, true).map(resetText).sort()),
  ["Bye", "Episode title", "Hey there", "The\nangels"]
);
assert.deepEqual(
  plain(overlay.buildEvents("dub", resetSources, false).map(resetText).sort()),
  ["Bye", "Episode title", "Hey there", "The\nangels"]
);
assert.deepEqual(
  plain(overlay.buildEvents("off", resetSources, true).map(resetText).sort()),
  ["Episode title", "The\nangels"]
);
assert.deepEqual(
  plain(overlay.buildEvents("off", resetSources, false).map(resetText).sort()),
  ["Episode title", "The\nangels"]
);

const pairTrack = overlay.parse(
  placedHeader +
    "Dialogue: 0,0:00:01.00,0:00:02.00,BottomCenter,,0,0,0,,Hello there\n" +
    "Dialogue: 0,0:00:01.00,0:00:02.00,TopCenter,,0,0,0,,Shop\n" +
    "Dialogue: 0,0:00:01.00,0:00:02.00,TopCenter,,0,0,0,,Other card\n" +
    "Dialogue: 0,0:00:05.00,0:00:06.00,TopCenter,,0,0,0,,Later card"
);
const pairCaptions = overlay.parse(
  placedHeader +
    "Dialogue: 0,0:00:01.00,0:00:02.00,Captions,,0,0,0,,Spoken dub\n" +
    "Dialogue: 0,0:00:01.00,0:00:02.00,Captions,,0,0,0,,{\\pos(100,40)}Shop"
);
const pairSources = { original: pairTrack, captions: pairCaptions };
const pairText = (event) => event.segments.map((segment) => segment.text).join("");
assert.deepEqual(
  plain(overlay.buildEvents("sub", pairSources, false).map(pairText).sort()),
  ["Hello there", "Later card", "Other card", "Shop"],
  "two TopCenter cards that share a time both stay, and the sub file is not doubled"
);
assert.equal(overlay.buildEvents("sub", pairSources, false).length, pairTrack.events.length);
assert.deepEqual(
  plain(overlay.buildEvents("dub", pairSources, false).map(pairText).sort()),
  ["Later card", "Other card", "Shop", "Spoken dub"]
);
assert.equal(
  overlay.buildEvents("dub", pairSources, false).filter((event) => pairText(event) === "Shop").length,
  1,
  "the same card text at the same time is drawn once"
);
assert.deepEqual(
  plain(overlay.buildEvents("off", pairSources, false).map(pairText).sort()),
  ["Later card", "Other card", "Shop"],
  "Subs Off keeps every distinct card and hides spoken lines"
);

// A sign translation stored as bottom dialogue in only one audio's file.
// The other file is silent for that span, so the line has to travel with
// every script and sit in the sign band instead of the spoken line.
const readingHeader = placedHeader;
const readingOriginal = overlay.parse(
  readingHeader +
    "Dialogue: 0,0:00:01.00,0:00:03.00,BottomCenter,,0,0,0,,Hello there\n" +
    "Dialogue: 0,0:00:10.00,0:00:13.00,BottomCenter,,0,0,0,,slew the war hawks"
);
const readingCaptions = overlay.parse(
  readingHeader +
    "Dialogue: 0,0:00:01.00,0:00:03.00,Captions,,0,0,0,,Spoken dub\n" +
    "Dialogue: 0,0:00:20.00,0:00:22.00,Captions,,0,0,0,,Four days until X Day"
);
const readingSources = { original: readingOriginal, captions: readingCaptions };
const readingText = (event) => event.segments.map((segment) => segment.text).join("");
const readingEvents = (script) => overlay.buildEvents(script, readingSources, false);
readingEvents("sub");
const hawks = readingOriginal.events.find((event) => readingText(event) === "slew the war hawks");
const countdown = readingCaptions.events.find((event) => readingText(event).includes("Four days"));
assert.equal(overlay.isDialogue(hawks), false, "a sub-only sign reading is not spoken dialogue");
assert.equal(overlay.isDialogue(countdown), false, "a dub-only sign reading is not spoken dialogue");
assert.equal(hawks.alignment, 8);
assert.equal(countdown.alignment, 8);
for (const script of ["sub", "dub", "off"]) {
  const texts = readingEvents(script).map(readingText);
  assert.ok(texts.includes("slew the war hawks"), script + " keeps the sub-file sign reading");
  assert.ok(texts.includes("Four days until X Day"), script + " keeps the dub-file sign reading");
}
assert.ok(readingEvents("sub").map(readingText).includes("Hello there"));
assert.equal(readingEvents("dub").map(readingText).includes("Hello there"), false);
assert.ok(readingEvents("dub").map(readingText).includes("Spoken dub"));
assert.equal(readingEvents("sub").map(readingText).includes("Spoken dub"), false);
assert.deepEqual(plain(readingEvents("off").map(readingText).sort()), [
  "Four days until X Day",
  "slew the war hawks",
]);

// The sign line is the only line in the sub file, and the dub is saying
// something else at the same time. It still has to leave the spoken box.
const overlapHeader = readingHeader;
const overlapOriginal = overlay.parse(
  overlapHeader +
    "Dialogue: 0,0:00:10.00,0:00:16.00,BottomCenter,,0,0,0,,slew the war hawks"
);
const overlapCaptions = overlay.parse(
  overlapHeader +
    "Dialogue: 0,0:00:10.00,0:00:12.00,Captions,,0,0,0,,We have to run"
);
const overlapSources = { original: overlapOriginal, captions: overlapCaptions };
const overlapText = (event) => event.segments.map((segment) => segment.text).join("");
const overlapEvents = (script) => overlay.buildEvents(script, overlapSources, false);
const overlapHawks = overlapOriginal.events[0];
overlapEvents("sub");
assert.equal(overlay.isDialogue(overlapHawks), false, "unmatched sub line is a sign");
assert.equal(overlapHawks.alignment, 8);
for (const script of ["sub", "dub", "off"]) {
  assert.ok(
    overlapEvents(script).map(overlapText).includes("slew the war hawks"),
    script + " shows the unmatched sign line"
  );
}
assert.ok(overlapEvents("dub").map(overlapText).includes("We have to run"));
assert.equal(overlapEvents("sub").map(overlapText).includes("We have to run"), false);
assert.equal(overlapEvents("off").map(overlapText).includes("We have to run"), false);

const twinSign = {
  start: 1,
  end: 3,
  alignment: 8,
  styleName: "TopCenter",
  actor: "",
  pos: null,
  move: null,
  rotation: 0,
  segments: [{ text: "Hello" }],
};
const twinSpeech = {
  start: 1,
  end: 3,
  alignment: 2,
  styleName: "Default",
  actor: "",
  pos: null,
  move: null,
  rotation: 0,
  segments: [{ text: "Hello" }],
};
const otherSpeech = Object.assign({}, twinSpeech, {
  segments: [{ text: "Goodbye" }],
});
const kept = overlay.dropDuplicateTranslations([twinSpeech, twinSign, otherSpeech]);
assert.deepEqual(
  plain(kept.map((event) => event.segments[0].text)),
  ["Hello", "Goodbye"]
);
assert.equal(overlay.isDialogue(kept[0]), false);

console.log("subtitle parser checks passed");
