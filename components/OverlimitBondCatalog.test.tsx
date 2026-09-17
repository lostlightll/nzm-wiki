import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { OverlimitBondCatalog } from "./OverlimitBondCatalog";
import { OverlimitEffectValues } from "./OverlimitEffectValues";
import { getOverlimitCatalog, getOverlimitPreviewCatalog } from "@/lib/overlimit";
import { getActivePreview, getPreviewSeasonKey } from "@/lib/content-preview";
import { getProviderRelationsForSource, PROVIDER_RELATIONS } from "@/lib/multiplier-data";

test("preview bond rows show matching multiplier links and keep replacement stages distinct", () => {
  const preview = getActivePreview();
  const catalog = getOverlimitPreviewCatalog();
  assert.ok(preview && catalog?.bonds);
  const season = getPreviewSeasonKey(preview);
  const markup = renderToStaticMarkup(<OverlimitBondCatalog catalog={catalog.bonds} sourceSeason={season} onSearchBond={() => {}} />);
  const fieldRow = markup.split('id="bond-力场-8"')[1]?.split("</li>")[0];
  assert.ok(fieldRow);
  assert.match(fieldRow, /游戏模式乘区/);
  assert.match(fieldRow, /href="\/multiplier\?[^\"]*view=providers/);
  assert.doesNotMatch(fieldRow, /替代第/);
  const criticalRow = markup.split('id="bond-瞬暴-5"')[1]?.split("</li>")[0];
  assert.match(criticalRow ?? "", /暴伤乘区/);
  const superCriticalRow = markup.split('id="bond-瞬暴-8"')[1]?.split("</li>")[0];
  assert.match(superCriticalRow ?? "", /会心乘区/);
  const stackingRow = markup.split('id="bond-叠叠乐-8"')[1]?.split("</li>")[0];
  assert.ok(stackingRow);
  assert.doesNotMatch(stackingRow, /href="\/multiplier/);

  for (const count of [2, 5, 8]) {
    const relations = getProviderRelationsForSource({ type: "overlimit-bond", name: "力场", count, season });
    assert.equal(relations.length, 1);
    assert.equal(relations[0].modifierTypeId, "game-mode");
    assert.equal(relations[0].sourceHref, `/overlimit/preview?module=bonds#bond-${encodeURIComponent("力场")}-${count}`);
    assert.ok(PROVIDER_RELATIONS.includes(relations[0]));
  }
  assert.equal(getProviderRelationsForSource({ type: "overlimit-bond", name: "力场", count: 8 }).length, 0);
});

test("super critical card detail links its probability stat to the preview index once", () => {
  const catalog = getOverlimitPreviewCatalog()!;
  const sourceSeason = getPreviewSeasonKey(getActivePreview()!);
  for (const id of ["1317115001", "1317116001", "1317117001"]) {
    const card = catalog.cards.find(card => card.id === id)!;
    const markup = renderToStaticMarkup(<OverlimitEffectValues card={card} variant="detail" sourceSeason={sourceSeason} />);
    assert.match(markup, /会心概率/);
    assert.match(markup, /factor=super-critical/);
    assert.equal((markup.match(/<span>会心乘区<\/span>/g) ?? []).length, 1);
    const current = renderToStaticMarkup(<OverlimitEffectValues card={card} variant="detail" />);
    assert.doesNotMatch(current, /factor=super-critical/);
  }
});

test("current bond rows retain official reverse links and cannot borrow next-season identities", () => {
  const catalog = getOverlimitCatalog();
  assert.ok(catalog.bonds);
  const markup = renderToStaticMarkup(<OverlimitBondCatalog catalog={catalog.bonds} onSearchBond={() => {}} />);
  assert.match(markup, /id="bond-游击-4"/);
  assert.doesNotMatch(markup, /id="bond-力场-/);
  const current = getProviderRelationsForSource({ type: "overlimit-bond", name: "游击", count: 4 });
  assert.ok(current.length);
  assert.ok(current.every(relation => relation.sourceHref?.startsWith("/overlimit?module=bonds#")));
});
