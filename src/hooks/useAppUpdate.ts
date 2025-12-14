import { useEffect, useState } from 'react'
import { supabase, AppVersion } from '../services/supabase'
import { getBuildInfo } from '../config/build'

export function useAppUpdate() {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false)
  const [latestVersion, setLatestVersion] = useState<AppVersion | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUpdate()
  }, [])

  const checkUpdate = async () => {
    try {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        console.warn('Error checking for updates:', error)
        return
      }

      if (data) {
        const buildInfo = getBuildInfo()
        const currentVersion = buildInfo.version
        const currentBuildNumber = buildInfo.build

        console.log('[AppUpdate] Current:', currentVersion, currentBuildNumber)
        console.log('[AppUpdate] Latest:', data.version, data.build_number)

        // Priority 1: Check build number (timestamp) if both are available
        if (data.build_number && currentBuildNumber) {
          // Timestamp format: YYYYMMDD.HHMM - simple string comparison works
          if (data.build_number > currentBuildNumber) {
            console.log('[AppUpdate] Update available via build_number')
            setIsUpdateAvailable(true)
            setLatestVersion(data)
            return
          } else {
            // Build numbers are equal or current is newer
            console.log('[AppUpdate] No update needed (build_number check)')
            setIsUpdateAvailable(false)
            return
          }
        }

        // Priority 2: Fallback to semantic versioning
        if (compareVersions(currentVersion, data.version) < 0) {
          console.log('[AppUpdate] Update available via semver')
          setIsUpdateAvailable(true)
          setLatestVersion(data)
        } else {
          console.log('[AppUpdate] No update needed (semver check)')
          setIsUpdateAvailable(false)
        }
      }
    } catch (e) {
      console.error('Failed to check for updates:', e)
    } finally {
      setLoading(false)
    }
  }

  return { isUpdateAvailable, latestVersion, loading, checkUpdate }
}

/**
 * Compare two semantic version strings
 * Returns:
 * -1 if v1 < v2
 *  0 if v1 == v2
 *  1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number)
  const p2 = v2.split('.').map(Number)

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0
    const n2 = p2[i] || 0
    if (n1 > n2) return 1
    if (n1 < n2) return -1
  }
  return 0
}
