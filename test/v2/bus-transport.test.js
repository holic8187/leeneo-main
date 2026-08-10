'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
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
