import { Address } from '../models/address.model';

export function locationProximityScore(
  userAddress: Address | undefined,
  eventAddress: Address | undefined
): number {
  if (!userAddress || !eventAddress) return 0;

  let score = 0;
  const normalize = (value?: string): string => value?.trim().toLowerCase() ?? '';

  if (
    normalize(userAddress.state) &&
    normalize(userAddress.state) === normalize(eventAddress.state)
  ) {
    score += 50;
  }
  if (
    normalize(userAddress.city) &&
    normalize(userAddress.city) === normalize(eventAddress.city)
  ) {
    score += 100;
  }
  if (
    normalize(userAddress.neighborhood) &&
    normalize(userAddress.neighborhood) === normalize(eventAddress.neighborhood)
  ) {
    score += 30;
  }

  const userLat = userAddress.latitude;
  const userLng = userAddress.longitude;
  const eventLat = eventAddress.latitude;
  const eventLng = eventAddress.longitude;

  if (
    typeof userLat === 'number' &&
    typeof userLng === 'number' &&
    typeof eventLat === 'number' &&
    typeof eventLng === 'number' &&
    !Number.isNaN(userLat) &&
    !Number.isNaN(userLng) &&
    !Number.isNaN(eventLat) &&
    !Number.isNaN(eventLng)
  ) {
    const latDiff = userLat - eventLat;
    const lngDiff = userLng - eventLng;
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
    score += Math.max(0, 500 - Math.round(distance * 10000));
  }

  return score;
}
