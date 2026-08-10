'use strict';

const BUS_INTERVAL_MS = 15 * 60 * 1000;
const BUS_BOARDING_WINDOW_MS = 5 * 60 * 1000;
const BUS_TRAVEL_MS = 10 * 60 * 1000;
const BUS_TICKET_PRICE = 10_000;
const BUS_TICKET_ITEM_ID = 'peach_bus_ticket';
const BUS_STOP_MAP_ID = 'company_bus_stop';
const BUS_WAITING_MAP_ID = 'company_bus_waiting_room';
const BUS_TRANSIT_MAP_ID = 'company_bus_in_transit';
const PEACH_BUS_STOP_MAP_ID = 'peach_bus_stop';
const PEACH_BUS_WAITING_MAP_ID = 'peach_bus_waiting_room';
const PEACH_BUS_TRANSIT_MAP_ID = 'peach_bus_in_transit';
const BUS_DESTINATION_MAP_ID = PEACH_BUS_STOP_MAP_ID;

const BUS_ROUTES = Object.freeze([
  Object.freeze({
    id: 'company-to-peach',
    originMapId: BUS_STOP_MAP_ID,
    originName: '호이상사',
    waitingMapId: BUS_WAITING_MAP_ID,
    transitMapId: BUS_TRANSIT_MAP_ID,
    destinationMapId: PEACH_BUS_STOP_MAP_ID,
    destinationName: '피치전자'
  }),
  Object.freeze({
    id: 'peach-to-company',
    originMapId: PEACH_BUS_STOP_MAP_ID,
    originName: '피치전자',
    waitingMapId: PEACH_BUS_WAITING_MAP_ID,
    transitMapId: PEACH_BUS_TRANSIT_MAP_ID,
    destinationMapId: BUS_STOP_MAP_ID,
    destinationName: '호이상사'
  })
]);

function getNextBusDepartureAt(now = Date.now()) {
  const current = Math.max(0, Number(now) || Date.now());
  return (Math.floor(current / BUS_INTERVAL_MS) + 1) * BUS_INTERVAL_MS;
}

function getBusSchedule(now = Date.now()) {
  const current = Math.max(0, Number(now) || Date.now());
  const nextDepartureAt = getNextBusDepartureAt(current);
  const boardingOpensAt = nextDepartureAt - BUS_BOARDING_WINDOW_MS;
  return {
    nextDepartureAt,
    boardingOpensAt,
    boardingOpen: current >= boardingOpensAt && current < nextDepartureAt,
    boardingWindowMs: BUS_BOARDING_WINDOW_MS,
    travelMs: BUS_TRAVEL_MS
  };
}

function getStoredDepartureAt(character) {
  return new Date(character?.worldState?.busDepartureAt || 0).getTime() || 0;
}

function getBusRouteForMap(mapId, character = null) {
  const normalizedMapId = String(mapId || '');
  const direct = BUS_ROUTES.find((route) => (
    route.originMapId === normalizedMapId
    || route.waitingMapId === normalizedMapId
    || route.transitMapId === normalizedMapId
  ));
  if (direct) return direct;
  const storedOrigin = String(character?.worldState?.busOriginMapId || '');
  const storedDestination = String(character?.worldState?.busDestinationMapId || '');
  return BUS_ROUTES.find((route) => (
    route.originMapId === storedOrigin && route.destinationMapId === storedDestination
  )) || BUS_ROUTES.find((route) => route.originMapId === storedOrigin) || BUS_ROUTES[0];
}

function isBusStopMap(mapId) {
  return BUS_ROUTES.some((route) => route.originMapId === String(mapId || ''));
}

function isBusInteriorMap(mapId) {
  return BUS_ROUTES.some((route) => (
    route.waitingMapId === String(mapId || '') || route.transitMapId === String(mapId || '')
  ));
}

function clearBusState(character) {
  character.worldState.busDepartureAt = null;
  character.worldState.busOriginMapId = '';
  character.worldState.busDestinationMapId = '';
}

function setBusMap(character, mapId, x = 12) {
  if (!character.worldState || typeof character.worldState !== 'object') character.worldState = {};
  character.worldState.mapId = mapId;
  character.worldState.x = x;
  character.worldState.floor = 0;
}

function boardBus(character, departureAt) {
  const resolvedDepartureAt = Math.max(0, Number(departureAt) || 0);
  if (!resolvedDepartureAt) throw new Error('버스 출발 시각을 확인할 수 없습니다.');
  const route = getBusRouteForMap(character?.worldState?.mapId, character);
  if (String(character?.worldState?.mapId || '') !== route.originMapId) {
    throw new Error('버스정류장에서만 탑승할 수 있습니다.');
  }
  character.worldState.busDepartureAt = new Date(resolvedDepartureAt);
  character.worldState.busOriginMapId = route.originMapId;
  character.worldState.busDestinationMapId = route.destinationMapId;
  setBusMap(character, route.waitingMapId, 14);
  return route;
}

function exitWaitingBus(character, now = Date.now()) {
  const departureAt = getStoredDepartureAt(character);
  const route = getBusRouteForMap(character?.worldState?.mapId, character);
  if (String(character?.worldState?.mapId || '') !== route.waitingMapId) {
    throw new Error('현재 버스에서 내릴 수 없습니다.');
  }
  if (!departureAt || Number(now) >= departureAt) {
    throw new Error('이미 출발한 버스에서는 내릴 수 없습니다.');
  }
  clearBusState(character);
  setBusMap(character, route.originMapId, 70);
  return route;
}

function reconcileBusTravel(character, now = Date.now()) {
  const current = Math.max(0, Number(now) || Date.now());
  const mapId = String(character?.worldState?.mapId || '');
  if (!isBusInteriorMap(mapId)) return { changed: false, mapId, stage: 'none' };

  const route = getBusRouteForMap(mapId, character);
  const departureAt = getStoredDepartureAt(character);
  if (!departureAt) {
    clearBusState(character);
    setBusMap(character, route.originMapId, 70);
    return { changed: true, mapId: route.originMapId, stage: 'cancelled', routeId: route.id };
  }
  if (current < departureAt) {
    const changed = mapId !== route.waitingMapId;
    if (changed) setBusMap(character, route.waitingMapId, 14);
    return {
      changed,
      mapId: route.waitingMapId,
      stage: 'waiting',
      routeId: route.id,
      departureAt,
      arrivalAt: departureAt + BUS_TRAVEL_MS
    };
  }
  if (current < departureAt + BUS_TRAVEL_MS) {
    const changed = mapId !== route.transitMapId;
    if (changed) setBusMap(character, route.transitMapId, 50);
    return {
      changed,
      mapId: route.transitMapId,
      stage: 'transit',
      routeId: route.id,
      departureAt,
      arrivalAt: departureAt + BUS_TRAVEL_MS
    };
  }

  const destinationMapId = String(character.worldState.busDestinationMapId || route.destinationMapId);
  clearBusState(character);
  setBusMap(character, destinationMapId, 12);
  return {
    changed: true,
    mapId: destinationMapId,
    stage: 'arrived',
    routeId: route.id,
    departureAt,
    arrivalAt: departureAt + BUS_TRAVEL_MS
  };
}

function buildBusTransportView(character, now = Date.now(), ticketQuantity = 0) {
  const schedule = getBusSchedule(now);
  const departureAt = getStoredDepartureAt(character);
  const mapId = String(character?.worldState?.mapId || '');
  const route = getBusRouteForMap(mapId, character);
  const stage = mapId === route.waitingMapId
    ? 'waiting'
    : (mapId === route.transitMapId ? 'transit' : 'station');
  return {
    ...schedule,
    stage,
    routeId: route.id,
    departureAt: departureAt || null,
    arrivalAt: departureAt ? departureAt + BUS_TRAVEL_MS : null,
    ticketItemId: BUS_TICKET_ITEM_ID,
    ticketPrice: BUS_TICKET_PRICE,
    ticketQuantity: Math.max(0, Math.floor(Number(ticketQuantity) || 0)),
    originMapId: route.originMapId,
    originName: route.originName,
    waitingMapId: route.waitingMapId,
    transitMapId: route.transitMapId,
    destinationMapId: route.destinationMapId,
    destinationName: route.destinationName
  };
}

module.exports = {
  BUS_INTERVAL_MS,
  BUS_BOARDING_WINDOW_MS,
  BUS_TRAVEL_MS,
  BUS_TICKET_PRICE,
  BUS_TICKET_ITEM_ID,
  BUS_STOP_MAP_ID,
  BUS_WAITING_MAP_ID,
  BUS_TRANSIT_MAP_ID,
  BUS_DESTINATION_MAP_ID,
  PEACH_BUS_STOP_MAP_ID,
  PEACH_BUS_WAITING_MAP_ID,
  PEACH_BUS_TRANSIT_MAP_ID,
  BUS_ROUTES,
  getNextBusDepartureAt,
  getBusSchedule,
  getBusRouteForMap,
  isBusStopMap,
  isBusInteriorMap,
  boardBus,
  exitWaitingBus,
  reconcileBusTravel,
  buildBusTransportView
};
