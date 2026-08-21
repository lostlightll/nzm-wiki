import { Gauge, Zap } from "lucide-react";
import { MultiplierBadges } from "@/components/MultiplierBadges";
import type { MultiplierRelation } from "@/lib/multiplier-data";
import type { EffectValueStage, PerkEffectValue } from "@/types";

function effectKey(effect: PerkEffectValue): string {
  return effect.kind === "damage"
    ? `damage:${effect.modifierTypeId}`
    : `stat:${effect.statId}`;
}

function getCatalogStages(stages: EffectValueStage[]): EffectValueStage[] {
  if (stages.length <= 2) return stages;
  return [stages[0], stages[stages.length - 1]];
}

function CatalogEffect({ effect }: { effect: PerkEffectValue }) {
  const stages = getCatalogStages(effect.stages);

  return (
    <p className="break-words text-center text-[11px] font-medium leading-4 text-[#e2c38b] tabular-nums sm:text-xs">
      <span className="text-zinc-300">{effect.label}</span>{" "}
      {stages.map((stage, index) => (
        <span key={`${stage.condition ?? "base"}:${stage.value}`}>
          {index > 0 && <span className="px-1 text-zinc-600">·</span>}
          {index > 0 && stage.condition && (
            <span className="text-zinc-400">{stage.condition} </span>
          )}
          <strong className="font-semibold">{stage.value}</strong>
        </span>
      ))}
    </p>
  );
}

function DetailEffect({
  effect,
  relations,
}: {
  effect: PerkEffectValue;
  relations: readonly MultiplierRelation[];
}) {
  const matchingRelations =
    effect.kind === "damage"
      ? relations.filter(
          (relation) => relation.modifierTypeId === effect.modifierTypeId,
        )
      : [];

  return (
    <div className="grid gap-3 rounded border border-white/10 bg-black/10 px-3 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center">
      <p className="text-sm font-medium text-zinc-200">{effect.label}</p>
      <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1.5">
        {effect.stages.map((stage) => (
          <p
            key={`${stage.condition ?? "base"}:${stage.value}`}
            className="min-w-0 text-sm leading-6 text-zinc-400"
          >
            {stage.condition && <span>{stage.condition} </span>}
            <strong className="font-semibold text-[#e2c38b] tabular-nums">
              {stage.value}
            </strong>
          </p>
        ))}
      </div>
      {matchingRelations.length > 0 && (
        <MultiplierBadges relations={matchingRelations} />
      )}
    </div>
  );
}

export function EffectValuesCatalog({
  effects,
}: {
  effects: readonly PerkEffectValue[];
}) {
  if (effects.length === 0) return null;
  return (
    <div className="w-full" aria-label="效果数值">
      {effects.map((effect) => (
        <CatalogEffect key={effectKey(effect)} effect={effect} />
      ))}
    </div>
  );
}

export function EffectValuesPanel({
  effects,
  relations = [],
  title = "效果数值",
  id,
  flush = false,
  className = "",
}: {
  effects: readonly PerkEffectValue[];
  relations?: readonly MultiplierRelation[];
  title?: string;
  id?: string;
  flush?: boolean;
  className?: string;
}) {
  if (effects.length === 0) return null;

  const damageEffects = effects.filter((effect) => effect.kind === "damage");
  const statEffects = effects.filter((effect) => effect.kind === "stat");
  const layoutClass = flush
    ? "border-t border-white/10 px-4 py-5 sm:px-6"
    : "overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-4 sm:px-5";

  return (
    <section
      id={id}
      aria-label={title}
      className={`${layoutClass} ${className}`.trim()}
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
        <Zap aria-hidden="true" className="h-4 w-4 text-[#d1ac69]" />
        {title}
      </h2>
      <div className="space-y-4">
        {damageEffects.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium text-zinc-500">增伤</h3>
            <div className="space-y-2">
              {damageEffects.map((effect) => (
                <DetailEffect
                  key={effectKey(effect)}
                  effect={effect}
                  relations={relations}
                />
              ))}
            </div>
          </div>
        )}
        {statEffects.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <Gauge aria-hidden="true" className="h-3.5 w-3.5" />
              属性
            </h3>
            <div className="space-y-2">
              {statEffects.map((effect) => (
                <DetailEffect
                  key={effectKey(effect)}
                  effect={effect}
                  relations={relations}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
