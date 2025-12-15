/**
 * Onboarding - Welcome flow for first-time users
 * Includes language selection on first slide
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
  Modal,
  ScrollView,
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
import { useLanguageStore, type Language } from '../src/stores/languageStore'
import { Icon } from '../src/components/ui/Icon'

// Language options with native names
const languages: { code: Language; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
]

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
  scrollX: { value: number }
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

/**
 * Language Selector Button
 */
function LanguageSelector() {
  const { colors } = useThemeStore()
  const { language, setLanguage } = useLanguageStore()
  const [showModal, setShowModal] = useState(false)
  
  const currentLang = languages.find(l => l.code === language) || languages[0]
  
  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          setShowModal(true)
        }}
        style={[styles.languageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityLabel={`Language: ${currentLang.name}. Tap to change.`}
        accessibilityRole="button"
      >
        <Icon name="settings" size={16} color={colors.textSecondary} />
        <Text style={[styles.languageButtonText, { color: colors.text }]}>
          {currentLang.nativeName}
        </Text>
        <Icon name="chevron-down" size={14} color={colors.textMuted} />
      </Pressable>
      
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowModal(false)}
        >
          <Animated.View 
            entering={FadeInUp.duration(200)}
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Select Language
            </Text>
            <ScrollView style={styles.languageList}>
              {languages.map((lang) => (
                <Pressable
                  key={lang.code}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    setLanguage(lang.code)
                    setShowModal(false)
                  }}
                  style={[
                    styles.languageOption,
                    { 
                      backgroundColor: language === lang.code ? colors.primary : colors.surfaceAlt,
                      borderColor: language === lang.code ? colors.primary : colors.border,
                    }
                  ]}
                  accessibilityLabel={`${lang.name} - ${lang.nativeName}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: language === lang.code }}
                >
                  <View>
                    <Text style={[
                      styles.languageOptionName, 
                      { color: language === lang.code ? colors.primaryText : colors.text }
                    ]}>
                      {lang.nativeName}
                    </Text>
                    <Text style={[
                      styles.languageOptionSubtext,
                      { color: language === lang.code ? colors.primaryText : colors.textMuted }
                    ]}>
                      {lang.name}
                    </Text>
                  </View>
                  {language === lang.code && (
                    <Icon name="check" size={20} color={colors.primaryText} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
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
  const isFirstSlide = currentIndex === 0

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
      {/* Top Bar: Language (left) + Skip (right) */}
      <View style={styles.topBar}>
        {/* Language Selector - only on first slide */}
        <Animated.View entering={FadeIn.delay(200).duration(400)}>
          {isFirstSlide ? (
            <LanguageSelector />
          ) : (
            <View style={styles.topBarPlaceholder} />
          )}
        </Animated.View>
        
        {/* Skip Button */}
        <Animated.View entering={FadeIn.delay(300).duration(400)}>
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
      </View>

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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 10,
  },
  topBarPlaceholder: {
    width: 100,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48, // Accessibility: minimum touch target
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 48, // Accessibility: minimum touch target
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 20,
    maxHeight: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  languageList: {
    maxHeight: 300,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  languageOptionName: {
    fontSize: 17,
    fontWeight: '600',
  },
  languageOptionSubtext: {
    fontSize: 13,
    marginTop: 2,
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
    fontSize: 12, // Accessibility: consistent minimum
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

