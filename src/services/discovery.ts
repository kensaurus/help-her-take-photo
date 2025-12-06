/**
 * mDNS/Zeroconf service discovery for local network peer finding
 */

import Zeroconf from 'react-native-zeroconf'
import type { DiscoveredService, DeviceRole } from '../types'

const SERVICE_TYPE = 'helpherphoto'
const SERVICE_DOMAIN = 'local.'

export interface DiscoveryCallbacks {
  onServiceFound: (service: DiscoveredService) => void
  onServiceRemoved: (name: string) => void
  onError: (error: Error) => void
}

class DiscoveryService {
  private zeroconf: Zeroconf
  private isScanning = false
  private isPublishing = false
  private callbacks: DiscoveryCallbacks | null = null

  constructor() {
    this.zeroconf = new Zeroconf()
  }

  /**
   * Initialize discovery and set up event listeners
   */
  init(callbacks: DiscoveryCallbacks): void {
    this.callbacks = callbacks

    this.zeroconf.on('resolved', (service) => {
      if (!service.name?.startsWith(SERVICE_TYPE)) return
      
      const discovered: DiscoveredService = {
        name: service.name,
        host: service.host,
        port: service.port,
        addresses: service.addresses || [],
        txt: service.txt || {},
      }
      
      this.callbacks?.onServiceFound(discovered)
    })

    this.zeroconf.on('removed', (name) => {
      if (name?.startsWith(SERVICE_TYPE)) {
        this.callbacks?.onServiceRemoved(name)
      }
    })

    this.zeroconf.on('error', (error) => {
      this.callbacks?.onError(new Error(String(error)))
    })
  }

  /**
   * Start scanning for peer devices
   */
  startScanning(): void {
    if (this.isScanning) return
    
    this.isScanning = true
    this.zeroconf.scan(SERVICE_TYPE, 'tcp', SERVICE_DOMAIN)
  }

  /**
   * Stop scanning
   */
  stopScanning(): void {
    if (!this.isScanning) return
    
    this.isScanning = false
    this.zeroconf.stop()
  }

  /**
   * Publish this device as a service
   */
  publishService(
    deviceId: string,
    role: DeviceRole,
    port: number
  ): void {
    if (this.isPublishing) {
      this.unpublishService()
    }

    const serviceName = `${SERVICE_TYPE}-${deviceId.slice(0, 8)}`
    
    this.zeroconf.publishService(
      SERVICE_TYPE,
      'tcp',
      SERVICE_DOMAIN,
      serviceName,
      port,
      {
        deviceId,
        role,
        version: '1.0',
      }
    )
    
    this.isPublishing = true
  }

  /**
   * Unpublish service
   */
  unpublishService(): void {
    if (!this.isPublishing) return
    
    this.zeroconf.unpublishService(`${SERVICE_TYPE}`)
    this.isPublishing = false
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopScanning()
    this.unpublishService()
    this.zeroconf.removeAllListeners()
    this.callbacks = null
  }

  get scanning(): boolean {
    return this.isScanning
  }

  get publishing(): boolean {
    return this.isPublishing
  }
}

export const discoveryService = new DiscoveryService()

