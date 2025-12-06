/**
 * Hook for camera control using react-native-vision-camera
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useFrameProcessor,
  type PhotoFile,
  type CameraPosition,
} from 'react-native-vision-camera'
import * as MediaLibrary from 'expo-media-library'
import * as Haptics from 'expo-haptics'
import { useSettingsStore } from '../stores/settingsStore'

export function useCamera() {
  const cameraRef = useRef<Camera>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [isTakingPhoto, setIsTakingPhoto] = useState(false)
  const [lastPhoto, setLastPhoto] = useState<PhotoFile | null>(null)
  const [flashEnabled, setFlashEnabled] = useState(false)
  
  const { camera: cameraSettings, hapticFeedback, setCameraSettings } = useSettingsStore()
  
  const device = useCameraDevice(cameraSettings.cameraPosition)
  
  const format = useCameraFormat(device, [
    { photoResolution: { width: 1920, height: 1080 } },
    { fps: cameraSettings.fps },
  ])

  useEffect(() => {
    async function requestPermissions() {
      const cameraPermission = await Camera.requestCameraPermission()
      const mediaPermission = await MediaLibrary.requestPermissionsAsync()
      
      setHasPermission(
        cameraPermission === 'granted' && 
        mediaPermission.status === 'granted'
      )
    }
    
    requestPermissions()
  }, [])

  const takePhoto = useCallback(async (): Promise<PhotoFile | null> => {
    if (!cameraRef.current || isTakingPhoto) return null

    try {
      setIsTakingPhoto(true)
      
      if (hapticFeedback) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      }

      const photo = await cameraRef.current.takePhoto({
        flash: flashEnabled ? 'on' : 'off',
        enableShutterSound: true,
      })

      setLastPhoto(photo)
      return photo
    } catch (error) {
      console.error('Failed to take photo:', error)
      return null
    } finally {
      setIsTakingPhoto(false)
    }
  }, [isTakingPhoto, flashEnabled, hapticFeedback])

  const saveToLibrary = useCallback(async (photo: PhotoFile): Promise<string | null> => {
    try {
      const asset = await MediaLibrary.createAssetAsync(`file://${photo.path}`)
      
      if (hapticFeedback) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
      
      return asset.uri
    } catch (error) {
      console.error('Failed to save photo:', error)
      return null
    }
  }, [hapticFeedback])

  const takeAndSave = useCallback(async (): Promise<string | null> => {
    const photo = await takePhoto()
    if (!photo) return null
    return saveToLibrary(photo)
  }, [takePhoto, saveToLibrary])

  const toggleFlash = useCallback(() => {
    setFlashEnabled((prev) => !prev)
  }, [])

  const toggleCamera = useCallback(() => {
    const newPosition: CameraPosition = 
      cameraSettings.cameraPosition === 'back' ? 'front' : 'back'
    setCameraSettings({ cameraPosition: newPosition })
  }, [cameraSettings.cameraPosition, setCameraSettings])

  const focusAtPoint = useCallback(async (x: number, y: number) => {
    if (!cameraRef.current || !device?.supportsFocus) return
    
    try {
      await cameraRef.current.focus({ x, y })
      if (hapticFeedback) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }
    } catch {
      // Focus may fail if point is outside bounds
    }
  }, [device?.supportsFocus, hapticFeedback])

  return {
    cameraRef,
    device,
    format,
    hasPermission,
    isTakingPhoto,
    lastPhoto,
    flashEnabled,
    cameraPosition: cameraSettings.cameraPosition,
    takePhoto,
    saveToLibrary,
    takeAndSave,
    toggleFlash,
    toggleCamera,
    focusAtPoint,
  }
}

