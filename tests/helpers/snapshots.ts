import { createSanitation } from '../../src/missions/sanitation/domain/sanitation.ts';
import type { MissionId } from '../../src/app/progress.ts';
import { createHouse } from '../../src/missions/house-build/domain/house.ts';
import { createFire } from '../../src/missions/fire-rescue/domain/fire.ts';
import { createTraffic } from '../../src/missions/traffic-rescue/domain/traffic.ts';
import { createPolice } from '../../src/missions/police-patrol/domain/police.ts';
import { createPort } from '../../src/missions/port-cargo/domain/port.ts';
import { createMountain } from '../../src/missions/mountain-clearance/domain/mountain.ts';
import { createTransit } from '../../src/missions/passenger-transfer/domain/transit.ts';

// Pure fixtures shared by Node boundary tests and the isolated manual browser entry.
export const snapshotFixtures = [
  { id: 'house-build', title: '蓋房子', prefix: 'house', initial: 'gravel', stage: 'concrete',
    valid: () => ({ ...createHouse('concrete'), action: 'ready', pours: [0.4, 0, 1] }),
    legacy: () => { const { round, attached, ...state } = createHouse('concrete'); return { ...state, version: 2, action: 'ready', pours: [1, 0.4, 0] }; },
    invalid: () => ({ ...createHouse('complete'), gravel: 0 }),
  },
  { id: 'fire-rescue', title: '救火', prefix: 'fire', initial: 'dispatch', stage: 'ground-fire',
    valid: () => ({ ...createFire('ground-fire'), fires: [0, 1, 1, 1] }),
    invalid: () => ({ ...createFire('complete'), fires: [1, 0, 0, 0] }),
  },
  { id: 'traffic-rescue', title: '交通救援', prefix: 'traffic', initial: 'collision', stage: 'tow-exit',
    valid: () => ({ ...createTraffic('tow-exit', [1, 3], ['wheel-lift', 'flatbed'], 0), truckX: -9, action: 'dragging' }),
    legacy: () => ({ ...createTraffic('tow-exit', [1, 3], ['wheel-lift', 'flatbed'], 0), version: 2, selected: 1, truckX: 9 }),
    invalid: () => ({ ...createTraffic('complete', [1, 3]), cleaned: 0 }),
  },
  { id: 'police-patrol', title: '警察', prefix: 'police', initial: 'intro', stage: 'guard',
    valid: () => { const state = createPolice('guard', { layout: 1, color: 3, traffic: 'freight-first' }); return { ...state, work: { ...state.work, guard: 0.45 }, selected: 'bike1' }; },
    legacy: () => ({ version: 2, phase: 'guard', action: 'ready', round: { layout: 1, color: 3, body: 'van' }, elapsed: 0, active: null, aim: 0, work: { setup: 1, guard: 0.45, arrive: 0, door: 0, escort: 0 }, selected: 'bike1' }),
    invalid: () => ({ ...createPolice('complete'), selected: null }),
  },
  { id: 'port-cargo', title: '碼頭', prefix: 'port', initial: 'boat', stage: 'unload',
    valid: () => ({ ...createPort('unload'), selected: 1, craneAttached: true, lift: 1, load: { x: 2, z: -3 } }),
    legacy: () => { const { craneAttached, ...state } = createPort('unload'); return { ...state, version: 1, round: { layout: 0, palette: 0 }, selected: 1, lift: 1, load: { x: 2, z: -3 } }; },
    invalid: () => ({ ...createPort('complete'), loaded: [0, 0] }),
  },
  { id: 'mountain-clearance', title: '山路', prefix: 'mountain', initial: 'intro', stage: 'excavate',
    valid: () => ({ ...createMountain('excavate'), delivered: [0], carried: 2, bucket: { x: -2, y: 4.2, z: -3 } }),
    legacy: () => { const { workOrder, soilLoaded, loaderDocked, loaderSelected, loaderCarrying, loaderTravel, ...state } = createMountain('excavate'); return { ...state, version: 1, delivered: [0], carried: 2, bucket: { x: -2, y: 4.2, z: -3 } }; },
    invalid: () => ({ ...createMountain('complete'), delivered: [0, 0, 2] }),
  },
  { id: 'passenger-transfer', title: '轉運站', prefix: 'transfer', initial: 'intro', stage: 'bus-door',
    valid: () => { const state = createTransit('bus-door'); return { ...state, action: 'dragging', doors: { ...state.doors, bus: 0.4 } }; },
    legacy: () => { const state = createTransit('transfer-door'); return { ...state, version: 2, round: { layout: 0, palette: 0, cast: 0 }, doors: { ...state.doors, taxi: 0.4 } }; },
    invalid: () => ({ ...createTransit('complete'), order: ['taxi'] }),
  },
  { id: 'sanitation', title: '清潔隊', prefix: 'sanitation', initial: 'intro', stage: 'bin-lift',
    valid: () => ({ ...createSanitation('bin-lift'), action: 'dragging', held: 'bin', travel: 0.4, aim: 0.7 }),
    legacy: () => ({ ...createSanitation('bin-lift'), version: 1 }),
    invalid: () => ({ ...createSanitation('complete'), foodEmpty: false }),
  },
] satisfies Array<{ id: MissionId; title: string; prefix: string; initial: string; stage: string; valid: () => unknown; legacy?: () => unknown; invalid: () => unknown }>;
