"use client";

import {
  Check,
  Circle,
  Info,
  Minus,
  SquareCheckBig,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  DAMAGE_CHANNEL_MATRIX,
  type DamageChannel,
  type DamageChannelGroup,
  type DamageChannelStatus,
} from "@/lib/multiplier-data";

type GroupFilter = "all" | DamageChannelGroup;

const GROUP_OPTIONS: readonly { id: GroupFilter; label: string }[] = [
  { id: "all", label: "全部通道" },
  { id: "factor", label: "独立乘区" },
  { id: "dilution", label: "大稀释乘区" },
  { id: "correction", label: "特殊修正" },
];

const GROUP_LABELS: Record<DamageChannelGroup, string> = {
  factor: "独立乘区",
  dilution: "大稀释乘区",
  correction: "特殊修正",
};

const STATUS_META: Record<
  DamageChannelStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  applies: {
    label: "生效",
    icon: Circle,
    className: "text-[color:var(--guide-accent)]",
  },
  conditional: {
    label: "条件生效",
    icon: SquareCheckBig,
    className: "text-zinc-200",
  },
  none: {
    label: "不生效",
    icon: Minus,
    className: "text-zinc-500",
  },
};

function StatusMark({
  status,
  label,
  compact = false,
}: {
  status: DamageChannelStatus;
  label?: string;
  compact?: boolean;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const visibleLabel = label ?? meta.label;

  return (
    <span
      className={`inline-flex min-w-0 items-center justify-center gap-1.5 ${meta.className}`}
      title={visibleLabel}
    >
      <Icon
        aria-hidden="true"
        className={`shrink-0 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"} ${
          status === "applies" ? "fill-current" : ""
        }`}
        strokeWidth={status === "none" ? 2.5 : 1.8}
      />
      <span className={compact ? "text-[11px] leading-4" : "text-xs leading-4"}>
        {visibleLabel}
      </span>
    </span>
  );
}

function AttributeFieldName({ name }: { name: string }) {
  const segments = name.split(".");

  return (
    <>
      {segments.map((segment, index) => (
        <span key={`${segment}-${index}`}>
          {segment}
          {index < segments.length - 1 && (
            <>
              .<wbr />
            </>
          )}
        </span>
      ))}
    </>
  );
}

function ChannelDetail({ channel }: { channel: DamageChannel }) {
  const appliesCount = channel.effects.filter(
    ({ status }) => status !== "none",
  ).length;

  return (
    <aside
      aria-live="polite"
      aria-label={`${channel.label}详情`}
      className="overflow-hidden rounded-lg border border-zinc-600 bg-[linear-gradient(145deg,rgba(18,21,23,0.97),rgba(12,15,17,0.98))]"
    >
      <header className="border-b border-zinc-700 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[color:var(--guide-accent)]">
              {GROUP_LABELS[channel.group]}
            </p>
            <h3 className="mt-1 text-lg font-bold text-zinc-100">{channel.label}</h3>
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-400">
            {appliesCount}/{DAMAGE_CHANNEL_MATRIX.damageTypes.length}
          </span>
        </div>
      </header>

      <div className="space-y-5 p-4">
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Tag aria-hidden="true" className="h-4 w-4 text-zinc-300" />
            属性字段
          </h4>
          <div className="space-y-1.5">
            {channel.attributeFields.map((field) => (
              <div
                key={field}
                className="rounded-md border border-zinc-700 bg-zinc-800/45 px-2.5 py-2 font-mono text-[11px] leading-5 text-zinc-200"
              >
                <AttributeFieldName name={field} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Info aria-hidden="true" className="h-4 w-4 text-zinc-300" />
            说明
          </h4>
          <p className="text-sm leading-6 text-[color:var(--guide-muted)]">
            {channel.summary}
          </p>
        </section>
      </div>
    </aside>
  );
}

function DesktopMatrix({
  channels,
  selectedChannelId,
  onSelectChannel,
}: {
  channels: readonly DamageChannel[];
  selectedChannelId: string;
  onSelectChannel: (channelId: string) => void;
}) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-zinc-600 lg:block">
      <table className="w-full min-w-[820px] table-fixed border-collapse text-sm">
        <caption className="sr-only">增幅通道对各类伤害的适用范围</caption>
        <colgroup>
          <col className="w-40" />
          {DAMAGE_CHANNEL_MATRIX.damageTypes.map(({ id }) => (
            <col key={id} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-zinc-900/90">
            <th scope="col" className="border-r border-b border-zinc-700 px-3 py-3 text-left">
              增幅通道
            </th>
            {DAMAGE_CHANNEL_MATRIX.damageTypes.map(({ id, label }) => (
              <th
                key={id}
                scope="col"
                className="border-r border-b border-zinc-700 px-2 py-3 text-center font-semibold text-zinc-200 last:border-r-0"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {channels.map((channel) => {
            const selected = channel.id === selectedChannelId;

            return (
              <tr
                key={channel.id}
                className={
                  selected
                    ? "bg-[color:var(--guide-accent-soft)]"
                    : "bg-[#111416] hover:bg-zinc-800/45"
                }
              >
                <th
                  scope="row"
                  className={`border-r border-b border-zinc-700 p-0 text-left last:border-b-0 ${
                    selected ? "border-l-2 border-l-[color:var(--guide-accent)]" : ""
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectChannel(channel.id)}
                    className="min-h-11 w-full cursor-pointer touch-manipulation px-3 py-2 text-left font-semibold text-zinc-100 transition-colors duration-200 focus-visible:outline-none focus-visible:text-[color:var(--guide-accent)] focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none"
                  >
                    {channel.label}
                  </button>
                </th>
                {channel.effects.map((effect) => (
                  <td
                    key={effect.damageTypeId}
                    className="h-11 border-r border-b border-zinc-700 px-1.5 py-2 text-center last:border-r-0"
                  >
                    <StatusMark status={effect.status} label={effect.label} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MobileMatrix({
  channels,
  selectedChannelId,
  onSelectChannel,
}: {
  channels: readonly DamageChannel[];
  selectedChannelId: string;
  onSelectChannel: (channelId: string) => void;
}) {
  return (
    <ul className="space-y-3 lg:hidden">
      {channels.map((channel) => {
        const selected = channel.id === selectedChannelId;

        return (
          <li
            key={channel.id}
            className={`overflow-hidden rounded-lg border ${
              selected
                ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)]"
                : "border-zinc-700 bg-[#111416]"
            }`}
          >
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectChannel(channel.id)}
              className="flex min-h-11 w-full cursor-pointer touch-manipulation items-center justify-between gap-3 border-b border-zinc-700 px-3 py-2 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none"
            >
              <span className="font-semibold text-zinc-100">{channel.label}</span>
              {selected && (
                <Check
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-[color:var(--guide-accent)]"
                  strokeWidth={2.5}
                />
              )}
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-3">
              {channel.effects.map((effect, index) => {
                const damageType = DAMAGE_CHANNEL_MATRIX.damageTypes.find(
                  ({ id }) => id === effect.damageTypeId,
                );
                const isLastOrphan =
                  channel.effects.length % 2 === 1 &&
                  index === channel.effects.length - 1;

                return (
                  <div
                    key={effect.damageTypeId}
                    className={`flex min-h-14 flex-col items-center justify-center gap-1 border-zinc-700 px-2 py-2 text-center sm:border-r sm:[&:nth-child(3n)]:border-r-0 ${
                      index < 4 ? "border-b" : ""
                    } ${index < 3 ? "sm:border-b" : "sm:border-b-0"} ${
                      index % 2 === 0 && index < channel.effects.length - 1
                        ? "border-r"
                        : ""
                    } ${
                      isLastOrphan
                        ? "col-span-2 sm:col-span-1"
                        : ""
                    }`}
                  >
                    <span className="text-[11px] leading-4 text-zinc-400">
                      {damageType?.label}
                    </span>
                    <StatusMark
                      status={effect.status}
                      label={effect.label}
                      compact
                    />
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DamageChannelMatrix() {
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [selectedChannelId, setSelectedChannelId] = useState(
    DAMAGE_CHANNEL_MATRIX.channels[0].id,
  );
  const visibleChannels = useMemo(
    () =>
      groupFilter === "all"
        ? DAMAGE_CHANNEL_MATRIX.channels
        : DAMAGE_CHANNEL_MATRIX.channels.filter(
            ({ group }) => group === groupFilter,
          ),
    [groupFilter],
  );
  const selectedChannel =
    visibleChannels.find(({ id }) => id === selectedChannelId) ??
    visibleChannels[0];

  const selectGroup = (group: GroupFilter) => {
    setGroupFilter(group);
    const firstChannel = DAMAGE_CHANNEL_MATRIX.channels.find(
      ({ group: channelGroup }) => group === "all" || channelGroup === group,
    );
    if (firstChannel) {
      setSelectedChannelId(firstChannel.id);
    }
  };

  return (
    <section aria-labelledby="damage-channel-heading">
      <div className="mb-5 flex flex-col gap-4 xl:mb-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2
            id="damage-channel-heading"
            className="text-2xl font-bold text-zinc-100 xl:text-xl"
          >
            增幅通道覆盖表
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--guide-muted)]">
            按属性通道记录可增幅的伤害类型；同一次伤害可能同时具备多种标签。
          </p>
        </div>

        <div
          role="group"
          aria-label="筛选增幅通道"
          className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
        >
          {GROUP_OPTIONS.map(({ id, label }) => {
            const active = groupFilter === id;

            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => selectGroup(id)}
                className={`min-h-11 cursor-pointer touch-manipulation rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none xl:min-h-9 xl:py-1.5 ${
                  active
                    ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)]"
                    : "border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 border-y border-zinc-700 py-3 text-xs">
        {(Object.keys(STATUS_META) as DamageChannelStatus[]).map((status) => (
          <StatusMark key={status} status={status} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <DesktopMatrix
            channels={visibleChannels}
            selectedChannelId={selectedChannel.id}
            onSelectChannel={setSelectedChannelId}
          />
          <MobileMatrix
            channels={visibleChannels}
            selectedChannelId={selectedChannel.id}
            onSelectChannel={setSelectedChannelId}
          />
        </div>
        <ChannelDetail channel={selectedChannel} />
      </div>

      <footer className="mt-4 flex items-start justify-center gap-2 border-t border-zinc-700 px-3 pt-4 text-center text-xs leading-5 text-zinc-400 sm:text-sm">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>阶段性分类，条件生效项仍需结合距离、弱点许可和具体伤害标签实测核验。</p>
      </footer>
    </section>
  );
}
