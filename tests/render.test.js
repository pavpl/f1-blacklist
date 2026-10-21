import test from "node:test";
import assert from "node:assert/strict";
import { flagMarkup, teamMark } from "../render.js";

test("flagMarkup builds a local SVG image for a valid flag code", () => {
  const html = flagMarkup("gb", "card__flag");
  assert.match(html, /class="flag-icon card__flag"/);
  assert.match(html, /src="assets\/flags\/gb.svg"/);
  assert.match(html, /alt=""/);
  assert.match(html, /width="20"/);
});

test("flagMarkup normalizes case and rejects unsafe codes", () => {
  assert.match(flagMarkup("GB"), /assets\/flags\/gb\.svg/);
  assert.equal(flagMarkup(""), "");
  assert.equal(flagMarkup("../../evil"), "");
});

test("teamMark renders a decorative, escaped team badge", () => {
  const html = teamMark("MCL", "#FF8000", "lg");
  assert.match(html, /class="team-mark team-mark--lg"/);
  assert.match(html, /--team-color:#FF8000/);
  assert.match(html, />MCL</);
  assert.match(html, /aria-hidden="true"/);
});

test("teamMark escapes labels and colors and has a fallback label", () => {
  const html = teamMark("<x>", '"><script>');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;x&gt;/);
  assert.match(teamMark(null, "#fff"), />—</);
});
