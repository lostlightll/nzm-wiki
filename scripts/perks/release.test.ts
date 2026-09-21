import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import matter from "gray-matter";
import release from "../../config/content-version.json";
import variants from "../../data/num-skill-variants.json";
import providers from "../../data/modifier-providers.json";
import { getAllPerks, getAllPublishedPerks, getPerkByItemId } from "../../lib/perks";
import { getOverlimitCatalog, getOverlimitPreviewCatalog } from "../../lib/overlimit";
import { getPerkPreviewCatalog } from "../../lib/perk-preview";

test("S4 release has one live channel with no remaining preview consumers", () => {
  assert.equal(release.season, "s4");
  assert.equal("preview" in release, false);
  const perks = getAllPerks();
  assert.equal(perks.length, 551);
  assert.deepEqual(getAllPublishedPerks(), perks);
  assert.equal(getPerkPreviewCatalog(), null);
  assert.equal(getOverlimitPreviewCatalog(), null);
  assert.equal(getOverlimitCatalog().season.id, "s4");
  assert.equal(getOverlimitCatalog().cards.length, 177);
  for (const perk of perks) {
    assert.ok(!perk.slug.startsWith("preview/"));
    assert.ok(!perk.season?.endsWith("-preview"));
    const data = matter.read(`data/perks/${perk.slug}.mdx`).data;
    assert.equal(data.preview_change, undefined);
    assert.equal(data.independent_damage_snapshot, undefined);
  }
  for (const variant of variants.variants) assert.equal(variant.channel, "current");
  for (const entry of [...providers.providers, ...providers.exclusions]) {
    assert.ok(!("season" in entry.source && entry.source.season?.endsWith("-preview")));
  }
  for (const slot of [1, 2, 3, 4]) {
    const directory = `data/perk-preview/slot-${slot}`;
    const files = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
    assert.deepEqual(files.filter(file => file.endsWith(".mdx")), []);
  }
});

test("live changes and previously omitted available perks survive promotion", () => {
  assert.match(getPerkByItemId("20703040104")?.description ?? "", /45/);
  for (const id of ["20703040160", "20703040164"]) {
    const perk = getPerkByItemId(id);
    assert.ok(perk, id);
    assert.equal(getPerkByItemId(id, "preview"), undefined);
  }
});
