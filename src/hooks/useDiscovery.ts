/**
 * Hook for mDNS service discovery
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { discoveryService, type DiscoveryCallbacks } from '../services/discovery'
import { useConnectionStore } from '../stores/connectionStore'
import { usePairingStore } from '../stores/pairingStore'
import type { DiscoveredService, PeerDevice, DeviceRole } from '../types'

export function useDiscovery() {
  const [discoveredDevices, setDiscoveredDevices] = useState<Map<string, DiscoveredService>>(new Map())
  const [isScanning, setIsScanning] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { myDeviceId, pairedDeviceId } = usePairingStore()
  const { setStatus, setPeerDevice, setError: setConnectionError } = useConnectionStore()
  
  const callbacksRef = useRef<DiscoveryCallbacks | null>(null)

  useEffect(() => {
    callbacksRef.current = {
      onServiceFound: (service) => {
        setDiscoveredDevices((prev) => {
          const next = new Map(prev)
          next.set(service.name, service)
          return next
        })

        // Check if this is our paired device
        const deviceId = service.txt?.deviceId
        if (deviceId === pairedDeviceId) {
          const peerDevice: PeerDevice = {
            id: deviceId,
            name: service.name,
            ip: service.addresses[0] || service.host,
            port: service.port,
            role: (service.txt?.role as DeviceRole) || 'camera',
          }
          setPeerDevice(peerDevice)
          setStatus('connected')
        }
      },
      onServiceRemoved: (name) => {
        setDiscoveredDevices((prev) => {
          const next = new Map(prev)
          next.delete(name)
          return next
        })
      },
      onError: (err) => {
        setError(err.message)
        setConnectionError(err.message)
      },
    }

    discoveryService.init(callbacksRef.current)

    return () => {
      discoveryService.destroy()
    }
  }, [pairedDeviceId, setPeerDevice, setStatus, setConnectionError])

  const startScanning = useCallback(() => {
    setError(null)
    setStatus('discovering')
    discoveryService.startScanning()
    setIsScanning(true)
  }, [setStatus])

  const stopScanning = useCallback(() => {
    discoveryService.stopScanning()
    setIsScanning(false)
    setStatus('disconnected')
  }, [setStatus])

  const publishService = useCallback((role: DeviceRole, port: number) => {
    if (!myDeviceId) {
      console.warn('Cannot publish service without device ID')
      return
    }
    discoveryService.publishService(myDeviceId, role, port)
    setIsPublishing(true)
  }, [myDeviceId])

  const unpublishService = useCallback(() => {
    discoveryService.unpublishService()
    setIsPublishing(false)
  }, [])

  const getDevicesArray = useCallback((): DiscoveredService[] => {
    return Array.from(discoveredDevices.values())
  }, [discoveredDevices])

  const findPairedDevice = useCallback((): DiscoveredService | null => {
    if (!pairedDeviceId) return null
    
    for (const service of discoveredDevices.values()) {
      if (service.txt?.deviceId === pairedDeviceId) {
        return service
      }
    }
    return null
  }, [discoveredDevices, pairedDeviceId])

  return {
    discoveredDevices: getDevicesArray(),
    isScanning,
    isPublishing,
    error,
    startScanning,
    stopScanning,
    publishService,
    unpublishService,
    findPairedDevice,
  }
}

