'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  BUS_TRAVEL_MS,
  BUS_WAITING_MAP_ID,
  BUS_TRANSIT_MAP_ID,
  BUS_DESTINATION_MAP_ID,
  PEACH_BUS_STOP_MAP_ID,
  PEACH_BUS_WAITING_MAP_ID,
  PEACH_BUS_TRANSIT_MAP_ID,
  getBusSchedule,
  isBusInteriorMap,
  syncCharacterBusStopLocation,
  boardBus,
  exitWaitingBus,
  reconcileBusTravel
} = require('../../src/v2/services/busTransportService');
const { getItemDefinition } = require('../../src/v2/items/itemCatalog');

function characterAt(mapId) {
  return { worldState: { mapId, x: 8, floor: 0 } };
}

test('bus boarding opens for five minutes before each quarter-hour departure', () => {
  const base = Date.UTC(2026, 7, 10, 0, 0, 0);
  assert.equal(getBusSchedule(base + 9 * 60_000 + 59_999).boardingOpen, false);
  assert.equal(getBusSchedule(base + 10 * 60_000).boardingOpen, true);
  assert.equal(getBusSchedule(base + 14 * 60_000 + 59_999).boardingOpen, true);
  assert.equal(getBusSchedule(base + 15 * 60_000).boardingOpen, false);
});

test('boarded passengers move from the waiting bus to transit and then Peach Electronics', () => {
  const departureAt = Date.UTC(2026, 7, 10, 0, 15, 0);
  const character = characterAt('company_bus_stop');
  boardBus(character, departureAt);
  assert.equal(character.worldState.mapId, BUS_WAITING_MAP_ID);
  assert.equal(reconcileBusTravel(character, departureAt - 1).stage, 'waiting');
  assert.equal(reconcileBusTravel(character, departureAt).stage, 'transit');
  assert.equal(character.worldState.mapId, BUS_TRANSIT_MAP_ID);
  assert.equal(reconcileBusTravel(character, departureAt + BUS_TRAVEL_MS).stage, 'arrived');
  assert.equal(character.worldState.mapId, BUS_DESTINATION_MAP_ID);
  assert.equal(character.worldState.busDepartureAt, null);
});

test('passengers can leave only before the bus departs', () => {
  const departureAt = Date.UTC(2026, 7, 10, 0, 15, 0);
  const character = characterAt('company_bus_stop');
  boardBus(character, departureAt);
  exitWaitingBus(character, departureAt - 1);
  assert.equal(character.worldState.mapId, 'company_bus_stop');

  boardBus(character, departureAt);
  assert.throws(() => exitWaitingBus(character, departureAt), /이미 출발/);
});

test('Peach Electronics runs the same quarter-hour bus back to Hoi Company', () => {
  const departureAt = Date.UTC(2026, 7, 10, 0, 30, 0);
  const character = characterAt(PEACH_BUS_STOP_MAP_ID);
  boardBus(character, departureAt);
  assert.equal(character.worldState.mapId, PEACH_BUS_WAITING_MAP_ID);
  assert.equal(reconcileBusTravel(character, departureAt).stage, 'transit');
  assert.equal(character.worldState.mapId, PEACH_BUS_TRANSIT_MAP_ID);
  assert.equal(reconcileBusTravel(character, departureAt + BUS_TRAVEL_MS).stage, 'arrived');
  assert.equal(character.worldState.mapId, 'company_bus_stop');
});

test('the bus ticket is a one-hundred-stack miscellaneous item', () => {
  const ticket = getItemDefinition('peach_bus_ticket');
  assert.equal(ticket.category, 'misc');
  assert.equal(ticket.itemType, 'transport-ticket');
  assert.equal(ticket.maxStack, 100);
  assert.equal(isBusInteriorMap('company_bus_waiting_room'), true);
  assert.equal(isBusInteriorMap('peach_bus_in_transit'), true);
  assert.equal(isBusInteriorMap('peach_bus_stop'), false);
});

test('a live bus-stop location repairs a stale stored map before bus actions', () => {
  const character = characterAt('frozen_dispatch_yard');
  const resolvedMapId = syncCharacterBusStopLocation(
    character,
    'company_bus_stop',
    72
  );

  assert.equal(resolvedMapId, 'company_bus_stop');
  assert.equal(character.worldState.mapId, 'company_bus_stop');
  assert.equal(character.worldState.x, 72);
  assert.equal(character.worldState.floor, 0);
});

test('a non-stop client map cannot overwrite the stored bus action location', () => {
  const character = characterAt('frozen_dispatch_yard');
  const resolvedMapId = syncCharacterBusStopLocation(character, 'production_line', 50);

  assert.equal(resolvedMapId, 'frozen_dispatch_yard');
  assert.equal(character.worldState.mapId, 'frozen_dispatch_yard');
});

test('world heartbeat resolves bus travel before using its transition state', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../src/v2/registerV2Routes.js'),
    'utf8'
  );
  const routeStart = source.indexOf("app.post('/api/v2/world/heartbeat'");
  const routeEnd = source.indexOf("app.post('/api/v2/world/move'", routeStart);
  const heartbeatRoute = source.slice(routeStart, routeEnd > routeStart ? routeEnd : undefined);
  const declarationAt = heartbeatRoute.indexOf('const busTransition = reconcileBusTravel(profile, Date.now())');
  const useAt = heartbeatRoute.indexOf("if (busTransition.stage !== 'none')");

  assert.ok(routeStart >= 0);
  assert.ok(declarationAt >= 0);
  assert.ok(useAt > declarationAt);
  assert.match(heartbeatRoute, /'worldState\.mapId': profile\.worldState\.mapId/);
});

test('bus purchases and boarding synchronize the controlled client map', () => {
  const serverSource = fs.readFileSync(
    path.join(__dirname, '../../src/v2/registerV2Routes.js'),
    'utf8'
  );
  const clientSource = fs.readFileSync(
    path.join(__dirname, '../../public/v2/app.js'),
    'utf8'
  );
  const purchaseStart = serverSource.indexOf("app.post('/api/v2/bus/ticket/purchase'");
  const boardStart = serverSource.indexOf("app.post('/api/v2/bus/board'", purchaseStart);
  const exitStart = serverSource.indexOf("app.post('/api/v2/bus/exit'", boardStart);
  const purchaseRoute = serverSource.slice(purchaseStart, boardStart);
  const boardRoute = serverSource.slice(boardStart, exitStart);
  const applyActionStart = clientSource.indexOf('async function applyBusAction');
  const applyActionEnd = clientSource.indexOf('\n}', applyActionStart);
  const applyAction = clientSource.slice(applyActionStart, applyActionEnd);

  assert.match(purchaseRoute, /requireWorldControl\(req, res, auth\)/);
  assert.match(purchaseRoute, /syncCharacterBusStopLocation/);
  assert.match(boardRoute, /syncCharacterBusStopLocation/);
  assert.match(applyAction, /mapId: state\.currentMapId/);
  assert.match(applyAction, /x: getCharacterX\(\)/);
});
