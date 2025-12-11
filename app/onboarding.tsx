/**
 * Onboarding - Welcome flow for first-time users
 * Responsive design with smooth animations
 */

import { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useOnboardingStore } from '../src/stores/onboardingStore'
import { useThemeStore } from '../src/stores/themeStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { Icon } from '../src/components/ui/Icon'

interface OnboardingSlide {
  id: string
  icon: 'camera' | 'eye' | 'image' | 'user'
  title: string
  description: string
  highlight: string
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    icon: 'camera',
    title: 'Take Perfect Photos',
    description: 'Never hear "you didn\'t get my good side" again. Let your partner guide your camera in real-time.',
    highlight: 'Real-time guidance',
  },
  {
    id: '2',
    icon: 'eye',
    title: 'Director Mode',
    description: 'See exactly what the camera sees. Guide the photographer with live preview and voice feedback.',
    highlight: 'Live preview',
  },
  {
    id: '3',
    icon: 'image',
    title: 'Shared Gallery',
    description: 'All photos synced between devices instantly. No more "send me those photos" texts.',
    highlight: 'Instant sync',
  },
  {
    id: '4',
    icon: 'user',
    title: 'Save Your Relationship',
    description: 'Track your "scoldings saved" score and level up as a photographer. Gamification meets romance!',
    highlight: 'Gamification',
  },
]

function SlideItem({
  item,
  index,
  scrollX,
  width,
}: {
  item: OnboardingSlide
  index: number
  scrollX: Animated.SharedValue<number>
  width: number
}) {
  const { colors } = useThemeStore()
  const { height } = useWindowDimensions()
  const isSmallScreen = height < 700

  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width]
    
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.8, 1, 0.8],
      Extrapolation.CLAMP
    )
    
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.4, 1, 0.4],
      Extrapolation.CLAMP
    )

    return {
      transform: [{ scale }],
      opacity,
    }
  })

  const iconSize = isSmallScreen ? 60 : 80
  const titleSize = isSmallScreen ? 24 : 32
  const descSize = isSmallScreen ? 15 : 17

  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View style={[styles.slideContent, animatedStyle]}>
        {/* Icon Container */}
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: colors.primary,
              width: iconSize + 40,
              height: iconSize + 40,
            },
          ]}
          accessibilityElementsHidden
        >
          <Icon name={item.icon} size={iconSize} color={colors.primaryText} />
        </View>

        {/* Highlight Badge */}
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.badgeText, { color: colors.accentText }]}>
            {item.highlight}
          </Text>
        </View>

        {/* Title */}
        <Text
          style={[styles.title, { color: colors.text, fontSize: titleSize }]}
          accessibilityRole="header"
        >
          {item.title}
        </Text>

        {/* Description */}
        <Text
          style={[
            styles.description,
            { color: colors.textSecondary, fontSize: descSize },
          ]}
        >
          {item.description}
        </Text>
      </Animated.View>
    </View>
  )
}

function Pagination({
  currentIndex,
  total,
}: {
  currentIndex: number
  total: number
}) {
  const { colors } = useThemeStore()

  return (
    <View style={styles.pagination} accessibilityLabel={`Page ${currentIndex + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, index) => (
        <Animated.View
          key={index}
          entering={FadeIn.delay(index * 50).duration(300)}
          style={[
            styles.dot,
            {
              backgroundColor:
                index === currentIndex ? colors.primary : colors.border,
              width: index === currentIndex ? 24 : 8,
            },
          ]}
        />
      ))}
    </View>
  )
}

export default function OnboardingScreen() {
  const router = useRouter()
  const { colors } = useThemeStore()
  const { t } = useLanguageStore()
  const { completeOnboarding } = useOnboardingStore()
  const { width, height } = useWindowDimensions()
  const flatListRef = useRef<FlatList>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollX = useSharedValue(0)
  const buttonScale = useSharedValue(1)

  const isSmallScreen = height < 700
  const isLastSlide = currentIndex === slides.length - 1

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollX.value = event.nativeEvent.contentOffset.x
      const index = Math.round(event.nativeEvent.contentOffset.x / width)
      if (index !== currentIndex && index >= 0 && index < slides.length) {
        setCurrentIndex(index)
      }
    },
    [width, currentIndex, scrollX]
  )

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (isLastSlide) {
      completeOnboarding()
      router.replace('/')
    } else {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      })
    }
  }, [isLastSlide, currentIndex, completeOnboarding, router])

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    completeOnboarding()
    router.replace('/')
  }, [completeOnboarding, router])

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }))

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      {/* Skip Button */}
      <Animated.View
        entering={FadeIn.delay(300).duration(400)}
        style={styles.skipContainer}
      >
        <Pressable
          onPress={handleSkip}
          style={styles.skipButton}
          accessibilityLabel="Skip onboarding"
          accessibilityRole="button"
          accessibilityHint="Skip to the main app"
        >
          <Text style={[styles.skipText, { color: colors.textMuted }]}>
            Skip
          </Text>
        </Pressable>
      </Animated.View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <SlideItem
            item={item}
            index={index}
            scrollX={scrollX}
            width={width}
          />
        )}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        accessibilityLabel="Onboarding slides"
      />

      {/* Bottom Section */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(400)}
        style={styles.bottomSection}
      >
        <Pagination currentIndex={currentIndex} total={slides.length} />

        {/* Next/Get Started Button */}
        <Pressable
          onPress={handleNext}
          onPressIn={() => {
            buttonScale.value = withSpring(0.95, { damping: 15, stiffness: 400 })
          }}
          onPressOut={() => {
            buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 })
          }}
          accessibilityLabel={isLastSlide ? 'Get started' : 'Next slide'}
          accessibilityRole="button"
          accessibilityHint={
            isLastSlide
              ? 'Complete onboarding and go to the main app'
              : 'Go to the next onboarding slide'
          }
        >
          <Animated.View
            style={[
              styles.nextButton,
              {
                backgroundColor: colors.primary,
                paddingHorizontal: isLastSlide ? 48 : 32,
              },
              buttonAnimatedStyle,
            ]}
          >
            <Text
              style={[
                styles.nextButtonText,
                { color: colors.primaryText, fontSize: isSmallScreen ? 16 : 18 },
              ]}
            >
              {isLastSlide ? "Let's Go!" : 'Next'}
            </Text>
            {!isLastSlide && (
              <Icon
                name="chevron-right"
                size={20}
                color={colors.primaryText}
              />
            )}
          </Animated.View>
        </Pressable>

        {/* Page Indicator Text */}
        <Text
          style={[styles.pageIndicator, { color: colors.textMuted }]}
          accessibilityLabel={`Step ${currentIndex + 1} of ${slides.length}`}
        >
          {currentIndex + 1} of {slides.length}
        </Text>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipContainer: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 10,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  slideContent: {
    alignItems: 'center',
    maxWidth: 360,
  },
  iconContainer: {
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 8,
  },
  bottomSection: {
    paddingHorizontal: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    gap: 8,
    minWidth: 160,
  },
  nextButtonText: {
    fontWeight: '700',
  },
  pageIndicator: {
    marginTop: 20,
    fontSize: 13,
    fontWeight: '500',
  },
})

