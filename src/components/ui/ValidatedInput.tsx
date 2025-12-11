/**
 * ValidatedInput - Input with real-time validation feedback
 * Provides visual and haptic feedback for form validation
 * 
 * Features:
 * - Animated border color changes
 * - Success checkmark animation
 * - Error shake animation
 * - Haptic feedback on validation state change
 */

import { useState, useEffect, useRef } from 'react'
import {
  TextInput,
  TextInputProps,
  View,
  Text,
  StyleSheet,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useThemeStore } from '../../stores/themeStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { triggerHaptic } from '../../utils/haptics'
import { Icon } from './Icon'

type ValidationState = 'idle' | 'valid' | 'invalid'

interface ValidatedInputProps extends Omit<TextInputProps, 'style'> {
  label?: string
  error?: string
  validate?: (value: string) => boolean
  showValidIcon?: boolean
  containerStyle?: object
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

export function ValidatedInput({
  label,
  error,
  validate,
  showValidIcon = true,
  value,
  onChangeText,
  containerStyle,
  ...props
}: ValidatedInputProps) {
  const { colors, mode } = useThemeStore()
  const { settings } = useSettingsStore()
  const reduceMotion = settings.reduceMotion
  
  const [isFocused, setIsFocused] = useState(false)
  const [validationState, setValidationState] = useState<ValidationState>('idle')
  const prevValidationState = useRef<ValidationState>('idle')
  
  // Animation values
  const borderProgress = useSharedValue(0)
  const shakeX = useSharedValue(0)
  const iconScale = useSharedValue(0)

  // Validate on value change
  useEffect(() => {
    if (validate && value) {
      const isValid = validate(value as string)
      const newState: ValidationState = isValid ? 'valid' : 'invalid'
      
      // Only trigger haptics on state change
      if (prevValidationState.current !== newState && prevValidationState.current !== 'idle') {
        if (newState === 'valid') {
          triggerHaptic('success')
        } else if (newState === 'invalid' && (value as string).length > 0) {
          triggerHaptic('error')
          // Shake animation for errors
          if (!reduceMotion) {
            shakeX.value = withSequence(
              withTiming(-10, { duration: 50 }),
              withTiming(10, { duration: 50 }),
              withTiming(-10, { duration: 50 }),
              withTiming(10, { duration: 50 }),
              withTiming(0, { duration: 50 })
            )
          }
        }
      }
      
      prevValidationState.current = newState
      setValidationState(newState)
    } else if (!value) {
      prevValidationState.current = 'idle'
      setValidationState('idle')
    }
  }, [value, validate, reduceMotion])

  // Update icon animation
  useEffect(() => {
    if (validationState === 'valid' && showValidIcon) {
      iconScale.value = reduceMotion 
        ? withTiming(1, { duration: 100 })
        : withSpring(1, { damping: 12, stiffness: 200 })
    } else {
      iconScale.value = withTiming(0, { duration: 100 })
    }
  }, [validationState, showValidIcon, reduceMotion])

  // Update border color based on state
  useEffect(() => {
    const targetValue = isFocused
      ? validationState === 'invalid' ? -1 : 1
      : 0
    borderProgress.value = withTiming(targetValue, { duration: 150 })
  }, [isFocused, validationState])

  // Interpolate border color
  const getBorderColor = () => {
    if (error || validationState === 'invalid') {
      return colors.error
    }
    if (validationState === 'valid') {
      return colors.success
    }
    if (isFocused) {
      return colors.primary
    }
    return colors.border
  }

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }))

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surface,
      borderColor: getBorderColor(),
      color: colors.text,
    },
  ]

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconScale.value,
  }))

  return (
    <Animated.View style={[styles.container, containerStyle, containerAnimatedStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      )}
      
      <View style={styles.inputContainer}>
        <AnimatedTextInput
          style={inputStyle}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor={colors.textMuted}
          {...props}
        />
        
        {showValidIcon && validationState === 'valid' && (
          <Animated.View style={[styles.validIcon, iconAnimatedStyle]}>
            <View style={[styles.validIconBg, { backgroundColor: colors.success }]}>
              <Icon name="check" size={12} color="#fff" />
            </View>
          </Animated.View>
        )}
      </View>
      
      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
      )}
    </Animated.View>
  )
}

/**
 * CodeInput - Specialized input for pairing codes
 * Shows digit boxes with individual validation
 */
interface CodeInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (code: string) => void
  error?: string
}

export function CodeInput({
  length = 4,
  value,
  onChange,
  onComplete,
  error,
}: CodeInputProps) {
  const { colors } = useThemeStore()
  const { settings } = useSettingsStore()
  const inputRef = useRef<TextInput>(null)
  
  const shakeX = useSharedValue(0)
  
  // Handle value change
  const handleChange = (text: string) => {
    // Only allow digits
    const digits = text.replace(/[^0-9]/g, '').slice(0, length)
    onChange(digits)
    
    // Haptic feedback for each digit
    if (digits.length > value.length) {
      triggerHaptic('tick')
    }
    
    // Call onComplete when code is full
    if (digits.length === length) {
      onComplete?.(digits)
    }
  }

  // Shake on error
  useEffect(() => {
    if (error && !settings.reduceMotion) {
      shakeX.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(0, { duration: 50 })
      )
      triggerHaptic('error')
    }
  }, [error, settings.reduceMotion])

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }))

  const digits = value.split('')

  return (
    <Animated.View style={[styles.codeContainer, containerStyle]}>
      <Pressable onPress={() => inputRef.current?.focus()}>
        <View style={styles.codeBoxes}>
          {Array.from({ length }, (_, i) => (
            <View
              key={i}
              style={[
                styles.codeBox,
                {
                  backgroundColor: colors.surface,
                  borderColor: error
                    ? colors.error
                    : digits[i]
                    ? colors.primary
                    : colors.border,
                },
              ]}
            >
              <Text style={[styles.codeDigit, { color: colors.text }]}>
                {digits[i] || ''}
              </Text>
            </View>
          ))}
        </View>
      </Pressable>
      
      {/* Hidden input for keyboard */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
      />
      
      {error && (
        <Text style={[styles.errorText, { color: colors.error, marginTop: 12 }]}>
          {error}
        </Text>
      )}
    </Animated.View>
  )
}

// Need to import Pressable
import { Pressable } from 'react-native'

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  validIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
  },
  validIconBg: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  // Code input styles
  codeContainer: {
    alignItems: 'center',
  },
  codeBoxes: {
    flexDirection: 'row',
    gap: 12,
  },
  codeBox: {
    width: 56,
    height: 64,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeDigit: {
    fontSize: 28,
    fontWeight: '700',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
})

