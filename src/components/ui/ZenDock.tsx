/**
 * ZenDock - Minimal pastel floating dock navigation
 * 
 * Design Philosophy:
 * - Clean, minimal icons (no emoji)
 * - Soft, dreamy pastel aesthetic
 * - Floating pill shape with subtle shadow
 * - Microinteractions with bouncy springs
 * - Center action button elevated with glow
 */

import { View, Pressable, StyleSheet, Dimensions, Platform } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useRouter, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useThemeStore } from '../../stores/themeStore'
import { Icon } from './Icon'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const DOCK_WIDTH = Math.min(SCREEN_WIDTH - 48, 320)
const DOCK_HEIGHT = 56
const ICON_SIZE = 22
const CENTER_BUTTON_SIZE = 48

type DockItem = {
  name: string
  icon: 'home' | 'image' | 'capture' | 'user' | 'settings'
  route: string
  isCenter?: boolean
  label?: string
}

const dockItems: DockItem[] = [
  { name: 'Home', icon: 'home', route: '/', label: 'Home' },
  { name: 'Gallery', icon: 'image', route: '/gallery', label: 'Gallery' },
  { name: 'Capture', icon: 'capture', route: '/pairing', isCenter: true, label: 'Capture' },
  { name: 'Profile', icon: 'user', route: '/profile', label: 'Profile' },
  { name: 'Settings', icon: 'settings', route: '/settings', label: 'Settings' },
]

/**
 * Individual dock item with microinteractions
 */
function DockItemButton({ 
  item, 
  isActive 
}: { 
  item: DockItem
  isActive: boolean 
}) {
  const { colors } = useThemeStore()
  const router = useRouter()
  
  const scale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const glowOpacity = useSharedValue(isActive ? 1 : 0)

  // Update glow when active state changes
  glowOpacity.value = withTiming(isActive ? 1 : 0, { duration: 200 })

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    if (item.isCenter) {
      scale.value = withSpring(0.92, { damping: 15, stiffness: 400 })
    } else {
      scale.value = withSpring(0.88, { damping: 18, stiffness: 350 })
      translateY.value = withSpring(-2, { damping: 18, stiffness: 350 })
    }
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 280 })
    translateY.value = withSpring(0, { damping: 12, stiffness: 280 })
  }

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.9, { damping: 20, stiffness: 500 }),
      withSpring(1.08, { damping: 12, stiffness: 280 }),
      withSpring(1, { damping: 14, stiffness: 300 })
    )
    
    Haptics.impactAsync(
      item.isCenter 
        ? Haptics.ImpactFeedbackStyle.Medium 
        : Haptics.ImpactFeedbackStyle.Light
    )
    
    router.push(item.route as any)
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }))

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(glowOpacity.value, [0, 1], [0.85, 1], Extrapolation.CLAMP) }],
  }))

  // Center button (capture) - elevated styling
  if (item.isCenter) {
    return (
      <View style={styles.centerButtonWrapper}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityLabel={item.label}
          accessibilityRole="button"
          accessibilityState={{ selected: isActive }}
          style={styles.centerButtonContainer}
        >
          {/* Soft glow behind button */}
          <Animated.View 
            style={[
              styles.centerButtonGlow,
              { backgroundColor: colors.primary },
              glowStyle,
            ]} 
          />
          
          <Animated.View 
            style={[
              styles.centerButton,
              { 
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
              },
              animatedStyle,
            ]}
          >
            <Icon 
              name={item.icon} 
              size={24} 
              color={colors.primaryText} 
            />
          </Animated.View>
        </Pressable>
      </View>
    )
  }

  // Regular dock items
  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={item.label}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      style={styles.dockItem}
    >
      {/* Active indicator background */}
      <Animated.View 
        style={[
          styles.activeIndicator,
          { backgroundColor: colors.pastelPink },
          glowStyle,
        ]} 
      />
      
      <Animated.View style={animatedStyle}>
        <Icon 
          name={item.icon} 
          size={ICON_SIZE} 
          color={isActive ? colors.primary : colors.textMuted} 
        />
      </Animated.View>
      
      {/* Active dot */}
      <Animated.View 
        style={[
          styles.activeDot,
          { backgroundColor: colors.primary },
          glowStyle,
        ]} 
      />
    </Pressable>
  )
}

/**
 * Main ZenDock component
 */
export function ZenDock() {
  const { colors, mode } = useThemeStore()
  const insets = useSafeAreaInsets()
  const pathname = usePathname()

  // Hide on specific screens
  const hiddenRoutes = ['/camera', '/viewer', '/onboarding', '/pairing', '/feedback', '/changelog', '/albums', '/friends']
  if (hiddenRoutes.some(route => pathname.startsWith(route))) {
    return null
  }

  const isActive = (route: string) => {
    if (route === '/') return pathname === '/' || pathname === '/index'
    return pathname.startsWith(route)
  }

  // Calculate safe bottom position
  const bottomOffset = Platform.select({
    ios: Math.max(insets.bottom, 16),
    android: 16,
    default: 16,
  })

  return (
    <View 
      style={[styles.container, { bottom: bottomOffset }]}
      pointerEvents="box-none"
    >
      <View 
        style={[
          styles.dockBackground,
          { 
            backgroundColor: mode === 'dark' 
              ? 'rgba(42, 37, 40, 0.92)' 
              : 'rgba(255, 255, 255, 0.92)',
            borderColor: mode === 'dark' ? colors.border : 'rgba(245, 160, 184, 0.2)',
            shadowColor: mode === 'dark' ? '#000' : 'rgba(245, 160, 184, 0.5)',
          },
        ]}
      >
        {/* Subtle pink tint overlay */}
        <View 
          style={[
            styles.tintOverlay,
            { 
              backgroundColor: mode === 'dark' 
                ? 'rgba(232, 139, 165, 0.04)' 
                : 'rgba(245, 160, 184, 0.06)',
            },
          ]} 
        />

        {/* Navigation items */}
        <View style={styles.dockContent}>
          {dockItems.map((item) => (
            <DockItemButton
              key={item.name}
              item={item}
              isActive={isActive(item.route)}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  dockBackground: {
    width: DOCK_WIDTH,
    height: DOCK_HEIGHT,
    borderRadius: DOCK_HEIGHT / 2,
    borderWidth: 1,
    // Shadow
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  tintOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DOCK_HEIGHT / 2,
  },
  dockContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 4,
  },
  dockItem: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  centerButtonWrapper: {
    width: CENTER_BUTTON_SIZE + 8,
    height: DOCK_HEIGHT + 16,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -16,
  },
  centerButtonContainer: {
    width: CENTER_BUTTON_SIZE + 8,
    height: CENTER_BUTTON_SIZE + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButtonGlow: {
    position: 'absolute',
    width: CENTER_BUTTON_SIZE + 8,
    height: CENTER_BUTTON_SIZE + 8,
    borderRadius: (CENTER_BUTTON_SIZE + 8) / 2,
    opacity: 0.25,
  },
  centerButton: {
    width: CENTER_BUTTON_SIZE,
    height: CENTER_BUTTON_SIZE,
    borderRadius: CENTER_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
})
