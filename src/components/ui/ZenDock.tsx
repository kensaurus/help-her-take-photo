/**
 * ZenDock - Cute pastel floating dock navigation
 * 
 * Design Philosophy:
 * - Soft, dreamy pastel aesthetic
 * - Floating pill shape with subtle shadow
 * - Microinteractions with bouncy springs
 * - Center action button elevated with glow
 * - Active states with soft pill backgrounds
 */

import { View, Pressable, StyleSheet, Dimensions } from 'react-native'
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
const DOCK_WIDTH = Math.min(SCREEN_WIDTH - 40, 340)
const DOCK_HEIGHT = 64
const ICON_SIZE = 24
const CENTER_BUTTON_SIZE = 56

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
function DockItem({ 
  item, 
  isActive 
}: { 
  item: DockItem
  isActive: boolean 
}) {
  const { colors, mode } = useThemeStore()
  const router = useRouter()
  
  const scale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const glowOpacity = useSharedValue(isActive ? 1 : 0)

  // Update glow when active state changes
  glowOpacity.value = withTiming(isActive ? 1 : 0, { duration: 200 })

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    if (item.isCenter) {
      // Center button has more dramatic animation
      scale.value = withSpring(0.9, { damping: 15, stiffness: 400 })
      translateY.value = withSpring(-2, { damping: 15, stiffness: 400 })
    } else {
      scale.value = withSpring(0.85, { damping: 18, stiffness: 350 })
      translateY.value = withSpring(-4, { damping: 18, stiffness: 350 })
    }
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 280 })
    translateY.value = withSpring(0, { damping: 12, stiffness: 280 })
  }

  const handlePress = () => {
    // Bouncy feedback animation
    scale.value = withSequence(
      withSpring(0.92, { damping: 20, stiffness: 500 }),
      withSpring(1.05, { damping: 12, stiffness: 280 }),
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
    transform: [{ scale: interpolate(glowOpacity.value, [0, 1], [0.8, 1], Extrapolation.CLAMP) }],
  }))

  // Center button (capture) - special elevated styling
  if (item.isCenter) {
    return (
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel={item.label}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        style={styles.centerButtonContainer}
      >
        {/* Outer glow ring */}
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
            size={28} 
            color={colors.primaryText} 
          />
        </Animated.View>
      </Pressable>
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
      {/* Active indicator pill */}
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
      
      {/* Active dot indicator */}
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

  // Don't show on camera/viewer/onboarding/pairing and sub-screens
  const hiddenRoutes = ['/camera', '/viewer', '/onboarding', '/pairing', '/feedback', '/changelog', '/albums', '/friends']
  if (hiddenRoutes.some(route => pathname.startsWith(route))) {
    return null
  }

  const isActive = (route: string) => {
    if (route === '/') return pathname === '/' || pathname === '/index'
    return pathname.startsWith(route)
  }

  return (
    <View 
      style={[
        styles.container, 
        { 
          bottom: Math.max(insets.bottom, 12) + 8,
        }
      ]}
      pointerEvents="box-none"
    >
      {/* Dock background with blur */}
      <View 
        style={[
          styles.dockBackground,
          { 
            backgroundColor: mode === 'dark' 
              ? 'rgba(42, 37, 40, 0.85)' 
              : 'rgba(255, 255, 255, 0.85)',
            borderColor: colors.border,
            shadowColor: mode === 'dark' ? '#000' : colors.primary,
          },
        ]}
      >
        {/* Decorative gradient overlay */}
        <View 
          style={[
            styles.gradientOverlay,
            { 
              backgroundColor: mode === 'dark' 
                ? 'rgba(232, 139, 165, 0.03)' 
                : 'rgba(245, 160, 184, 0.05)',
            },
          ]} 
        />

        {/* Dock items */}
        <View style={styles.dockContent}>
          {dockItems.map((item) => (
            <DockItem
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
    overflow: 'hidden',
    // Soft shadow
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DOCK_HEIGHT / 2,
  },
  dockContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  dockItem: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  centerButtonContainer: {
    width: CENTER_BUTTON_SIZE + 16,
    height: CENTER_BUTTON_SIZE + 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20, // Elevate above dock
  },
  centerButtonGlow: {
    position: 'absolute',
    width: CENTER_BUTTON_SIZE + 12,
    height: CENTER_BUTTON_SIZE + 12,
    borderRadius: (CENTER_BUTTON_SIZE + 12) / 2,
    opacity: 0.3,
  },
  centerButton: {
    width: CENTER_BUTTON_SIZE,
    height: CENTER_BUTTON_SIZE,
    borderRadius: CENTER_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Elevated shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
})
