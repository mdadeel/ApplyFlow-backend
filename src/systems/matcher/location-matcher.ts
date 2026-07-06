export interface LocationScore {
  score: number
  reason: string
}

export function computeLocationScore(
  userLocation: string | undefined,
  userPreferredLocations: string[],
  openToRemote: boolean,
  openToRelocation: boolean,
  opportunityLocationType: string | undefined,
  opportunityLocation: string | undefined,
): LocationScore {
  const locType = opportunityLocationType || 'unspecified'

  if (locType === 'remote') {
    return { score: openToRemote ? 1.0 : 0.6, reason: 'Remote position' }
  }

  if (locType === 'hybrid') {
    const sameCity = cityMatch(userLocation, userPreferredLocations, opportunityLocation)
    if (sameCity) return { score: 1.0, reason: `Located near ${opportunityLocation || 'office'}` }
    if (openToRelocation) return { score: 0.6, reason: 'Open to relocation for hybrid position' }
    return { score: 0.2, reason: `Not near ${opportunityLocation || 'office'} and not relocating` }
  }

  if (locType === 'onsite') {
    const sameCity = cityMatch(userLocation, userPreferredLocations, opportunityLocation)
    if (sameCity) return { score: 1.0, reason: `Located in ${opportunityLocation}` }
    if (openToRelocation) return { score: 0.6, reason: 'Open to relocation' }
    return { score: 0.2, reason: `Not in ${opportunityLocation} and not relocating` }
  }

  return { score: 0.5, reason: 'Location type unspecified' }
}

function cityMatch(
  userLocation: string | undefined,
  preferredLocations: string[],
  opportunityLocation: string | undefined,
): boolean {
  if (!opportunityLocation) return false
  const oppCity = opportunityLocation.toLowerCase().split(',')[0].trim()

  const allUserLocs = [userLocation || '', ...preferredLocations]
  return allUserLocs.some(loc =>
    loc.toLowerCase().includes(oppCity),
  )
}
