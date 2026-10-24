import * as sanitation from './sanitation/domain/sanitation.ts';
import { decodeSanitationSnapshot } from './sanitation/persistence.ts';
import { createSanitationSession } from './sanitation/session.ts';
import type { SanitationScene } from './sanitation/scene.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect, Result } from 'effect';
import type { TestContext } from 'node:test';
import type { SnapshotDecoder } from '../runtime/snapshot.ts';
import { clearProgress, loadProgress, saveProgress } from '../app/progress.ts';
import { loadDevelopment, saveDevelopment } from '../app/development.ts';
import { browser, Element } from '../../tests/helpers/lifecycle.ts';
import { snapshotFixtures } from '../../tests/helpers/snapshots.ts';
import * as house from './house-build/domain/house.ts';
import * as fire from './fire-rescue/domain/fire.ts';
import * as traffic from './traffic-rescue/domain/traffic.ts';
import * as police from './police-patrol/domain/police.ts';
import * as port from './port-cargo/domain/port.ts';
import * as mountain from './mountain-clearance/domain/mountain.ts';
import * as transit from './passenger-transfer/domain/transit.ts';
import { decodeHouseSnapshot } from './house-build/persistence.ts';
import { decodeFireSnapshot } from './fire-rescue/persistence.ts';
import { decodeTrafficSnapshot } from './traffic-rescue/persistence.ts';
import { decodePoliceSnapshot } from './police-patrol/persistence.ts';
import { decodePortSnapshot } from './port-cargo/persistence.ts';
import { decodeMountainSnapshot } from './mountain-clearance/persistence.ts';
import { decodeTransitSnapshot } from './passenger-transfer/persistence.ts';
import { createHouseSession } from './house-build/session.ts';
import { createFireSession } from './fire-rescue/session.ts';
import { createTrafficSession } from './traffic-rescue/session.ts';
import { createPoliceSession } from './police-patrol/session.ts';
import { createPortSession } from './port-cargo/session.ts';
import { createMountainSession } from './mountain-clearance/session.ts';
import { createTransferSession } from './passenger-transfer/session.ts';
import type { HouseScene } from './house-build/scene.ts';
import type { FireScene } from './fire-rescue/scene.ts';
import type { TrafficScene } from './traffic-rescue/scene.ts';
import type { PoliceScene } from './police-patrol/scene.ts';
import type { PortScene } from './port-cargo/scene.ts';
import type { MountainScene } from './mountain-clearance/scene.ts';
import type { TransferScene } from './passenger-transfer/scene.ts';

const audio = () => ({ setMuted() {}, setSpraying() {}, unlock: async () => {}, play() {}, dispose: async () => {} });
const scene = () => ({ canvas: new Element() });
const app = () => new Element() as unknown as HTMLDivElement;
const adapters = {
  sanitation: { decode: decodeSanitationSnapshot, resume: sanitation.resumeSanitation, states: () => sanitation.stages.flatMap(stage => ([0, 1] as const).map(layout => sanitation.createSanitation(stage, { layout, palette: 2, cast: 1 }))), create: createSanitationSession, connect: (session: ReturnType<typeof createSanitationSession>) => session.connect(scene() as unknown as SanitationScene, audio()) },
  'house-build': { decode: decodeHouseSnapshot, resume: house.resumeHouse, states: () => house.stages.flatMap(stage => (['gable', 'shed', 'flat'] as const).flatMap(roof => ([0, 1] as const).map(layout => house.createHouse(stage, { roof, layout, palette: 2, family: 1, pet: 'dog' })))), create: createHouseSession, connect: (session: ReturnType<typeof createHouseSession>) => session.connect(scene() as unknown as HouseScene, audio()) },
  'fire-rescue': { decode: decodeFireSnapshot, resume: fire.resumeFire, states: () => fire.stages.map(stage => fire.createFire(stage)), create: createFireSession, connect: (session: ReturnType<typeof createFireSession>) => session.connect(scene() as unknown as FireScene, audio()) },
  'traffic-rescue': { decode: decodeTrafficSnapshot, resume: traffic.resumeTraffic, states: () => traffic.stages.flatMap(stage => ([0, 1] as const).map(first => traffic.createTraffic(stage, [1, 3], first ? ['wheel-lift', 'flatbed'] : ['flatbed', 'wheel-lift'], first))), create: createTrafficSession, connect: (session: ReturnType<typeof createTrafficSession>) => session.connect(scene() as unknown as TrafficScene, audio()) },
  'police-patrol': { decode: decodePoliceSnapshot, resume: police.resumePolice, states: () => police.stages.flatMap(stage => [0, 1, 2, 3].map(layout => police.createPolice(stage, { layout, color: 2, body: 'van', bag: 1 }))), create: createPoliceSession, connect: (session: ReturnType<typeof createPoliceSession>) => session.connect(scene() as unknown as PoliceScene, audio()) },
  'port-cargo': { decode: decodePortSnapshot, resume: port.resumePort, states: () => (['load', 'unload'] as const).flatMap(direction => port.missionStages(direction).flatMap(stage => ([0, 1] as const).map(layout => port.createPort(stage, { direction, layout, palette: 2 })))), create: createPortSession, connect: (session: ReturnType<typeof createPortSession>) => session.connect(scene() as unknown as PortScene, audio()) },
  'mountain-clearance': { decode: decodeMountainSnapshot, resume: mountain.resumeMountain, states: () => (['rocks-first', 'soil-first'] as const).flatMap(order => mountain.stages.flatMap(stage => (['spread', 'cluster'] as const).flatMap(pattern => ([0, 1] as const).map(layout => mountain.createMountain(stage, { pattern, layout }, order))))), create: createMountainSession, connect: (session: ReturnType<typeof createMountainSession>) => session.connect(scene() as unknown as MountainScene, audio()) },
  'passenger-transfer': { decode: decodeTransitSnapshot, resume: transit.resumeTransit, states: () => transit.stages.flatMap(stage => (['school', 'coach'] as const).flatMap(companion => ([0, 1] as const).map(layout => transit.createTransit(stage, { layout, companion, palette: 1, cast: 2 })))), create: createTransferSession, connect: (session: ReturnType<typeof createTransferSession>) => session.connect(scene() as unknown as TransferScene, audio()) },
};
function storage(t: TestContext, data: Map<string, string>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage'), writes: string[] = [];
  const fault = { denied: false, writeDenied: false };
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() {
    if (fault.denied) throw new Error('denied getter');
    return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { if (fault.writeDenied) throw new Error('write denied'); writes.push(key); data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous); else Reflect.deleteProperty(globalThis, 'sessionStorage'); });
  return { writes, fault };
}
const assertDecoded = (decode: SnapshotDecoder<unknown>, value: unknown, expected: unknown) => {
  const result = decode(value, 'test');
  assert.ok(Result.isSuccess(result), Result.isFailure(result) ? String(result.failure.cause) : '');
  assert.deepEqual(result.success, expected);
};
for (const fixture of snapshotFixtures) {
  const adapter = adapters[fixture.id];
  const decode: SnapshotDecoder<unknown> = adapter.decode;
  test(`${fixture.id}: Schema preserves all entry configurations and partial work after pointer cancellation`, () => {
    for (const state of [...adapter.states(), fixture.valid()]) {
      const expected = adapter.resume(state); assert.ok(expected);
      assertDecoded(decode, JSON.parse(JSON.stringify(state)), expected);
    }
  });
  test(`${fixture.id}: Schema paths reject malformed input and domain invariants reject skipped work`, () => {
    for (const elapsed of [NaN, Infinity, -Infinity, '0', null]) {
      const result = decode({ ...fixture.valid(), elapsed }, 'damaged');
      assert.ok(Result.isFailure(result)); assert.equal(result.failure.stage, 'schema'); assert.match(String(result.failure.cause), /elapsed/);
    }
    for (const input of [null, {}, { ...fixture.valid(), version: 99 }, { ...fixture.valid(), phase: 'missing' }]) assert.ok(Result.isFailure(decode(input, 'bad')));
    const bad = decode(fixture.invalid(), 'invariant');
    assert.ok(Result.isFailure(bad)); assert.equal(bad.failure.stage, 'invariant');
  });
  for (const dev of [false, true]) {
    test(`${fixture.id}: ${dev ? 'development' : 'formal'} pagehide saves synchronously and denied storage retains progress`, async t => {
      const env = browser(t);
      const query = `?storage-test=${fixture.id}-${dev}`; globalThis.location.search = query;
      const key = dev ? `town-crew:${fixture.prefix}:dev:v1:${query}` : `town-crew:play:v1:${fixture.id}`;
      const disk = new Map([[key, JSON.stringify(fixture.valid())]]), { writes, fault } = storage(t, disk);
      const session = adapter.create(app(), dev, () => {}), expected = adapter.resume(fixture.valid());
      // Each adapter only uses connect-time scene.canvas; frame rendering is not started here.
      const connect = adapter.connect as (value: typeof session) => ReturnType<typeof adapter.connect>;
      await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
        yield* connect(session);
        const before = writes.length; env.window.dispatchEvent(new Event('pagehide'));
        assert.equal(writes.length, before + 1); assert.equal(writes.at(-1), key);
        assert.deepEqual(JSON.parse(disk.get(key)!), expected);
        fault.denied = true;
        session.save();
        adapter.create(app(), dev, () => {}).save();
        assert.deepEqual(dev ? loadDevelopment(key) : loadProgress(fixture.id), expected);
      })));
      // A fresh start must mask the old disk state even when storage cannot be removed.
      if (!dev) clearProgress(fixture.id);
      adapter.create(app(), dev, () => {}, true).save();
      const fresh = (dev ? loadDevelopment(key) : loadProgress(fixture.id)) as { phase: string };
      assert.equal(fresh.phase, fixture.initial);
      assert.deepEqual(JSON.parse(disk.get(key)!), expected);
    });
  }
  test(`${fixture.id}: damaged development JSON starts a valid fresh mission`, t => {
    browser(t); const query = `?bad-json=${fixture.id}`; globalThis.location.search = query;
    const key = `town-crew:${fixture.prefix}:dev:v1:${query}`;
    const disk = new Map([[key, '{bad']]); storage(t, disk);
    adapter.create(app(), true, () => {}).save();
    const state = loadDevelopment(key) as { phase: string };
    assert.equal(state.phase, fixture.initial); assert.ok(Result.isSuccess(decode(state, key)));
  });
}

for (const fixture of snapshotFixtures) {
  const adapter = adapters[fixture.id], decode: SnapshotDecoder<unknown> = adapter.decode;
  test(`${fixture.id}: only the current complete format can resume; obsolete saves start fresh`, t => {
    browser(t); storage(t, new Map());
    const current = fixture.valid();
    for (const version of [undefined, ...Array.from({ length: current.version }, (_, n) => n), current.version + 1]) {
      assert.ok(Result.isFailure(decode({ ...current, version }, 'version')));
      assert.equal(adapter.resume({ ...current, version }), undefined);
    }
    if (fixture.legacy) assert.ok(Result.isFailure(decode(fixture.legacy(), 'old')));
    for (const field of Object.keys(current)) {
      const incomplete: Record<string, unknown> = { ...current }; delete incomplete[field];
      assert.ok(Result.isFailure(decode(incomplete, 'missing')), `missing ${field}`);
    }
    for (const dev of [false, true]) {
      const query = `?old-version=${fixture.id}-${dev}`; globalThis.location.search = query;
      const key = `town-crew:${fixture.prefix}:dev:v1:${query}`, old = fixture.legacy?.() ?? { ...current, version: 0 };
      if (dev) saveDevelopment(key, old); else saveProgress(fixture.id, old);
      adapter.create(app(), dev, () => {}).save();
      const state = (dev ? loadDevelopment(key) : loadProgress(fixture.id)) as { phase: string; version: number };
      assert.equal(state.phase, fixture.initial); assert.equal(state.version, current.version);
    }
  });
  if (fixture.id === 'fire-rescue') continue; // This mission has no randomized last-round record.
  test(`${fixture.id}: failed last-round writes never replace newer memory with stale storage`, t => {
    browser(t); t.mock.method(Math, 'random', () => 0);
    const key = fixture.id === 'traffic-rescue' ? 'town-crew:traffic:last-colors:v1' : `town-crew:${fixture.prefix}:last-round:v${fixture.id === 'sanitation' ? 2 : 1}`;
    const original = fixture.valid() as { round?: unknown; colors?: unknown };
    const { fault } = storage(t, new Map([[key, JSON.stringify(original.round ?? original.colors)]])); fault.writeDenied = true;
    const next = () => {
      adapter.create(app(), false, () => {}, true).save();
      const state = loadProgress(fixture.id) as { round?: unknown; colors?: unknown };
      return state.round ?? state.colors;
    };
    const first = next(), second = next(); assert.notDeepEqual(first, second);
  });
}
