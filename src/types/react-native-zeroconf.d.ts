/**
 * Type declarations for react-native-zeroconf
 */

declare module 'react-native-zeroconf' {
  export interface Service {
    name: string
    fullName?: string
    host: string
    port: number
    addresses: string[]
    txt?: Record<string, string>
  }

  export default class Zeroconf {
    constructor()
    
    scan(type?: string, protocol?: string, domain?: string): void
    stop(): void
    
    publishService(
      type: string,
      protocol: string,
      domain: string,
      name: string,
      port: number,
      txt?: Record<string, string>
    ): void
    
    unpublishService(name: string): void
    
    on(event: 'start', callback: () => void): void
    on(event: 'stop', callback: () => void): void
    on(event: 'found', callback: (name: string) => void): void
    on(event: 'resolved', callback: (service: Service) => void): void
    on(event: 'removed', callback: (name: string) => void): void
    on(event: 'error', callback: (error: unknown) => void): void
    on(event: 'update', callback: () => void): void
    
    removeAllListeners(): void
  }
}

