/**
 * Typography configuration for Help Her Take Photo
 * 
 * Uses Nunito font family - soft, rounded, highly readable
 * Perfect for the zen pastel aesthetic
 */

import { Platform, TextStyle } from 'react-native'

// Font family names as loaded by expo-google-fonts
export const fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_500Medium',
  semiBold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
} as const

// Fallback to system font if custom font not loaded
const fallbackFont = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
})

/**
 * Typography scale - consistent text styles across the app
 * All sizes meet accessibility guidelines (min 12sp)
 */
export const typography = {
  // Display - Large headings
  displayLarge: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
  } as TextStyle,
  
  displayMedium: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.3,
  } as TextStyle,
  
  // Headlines
  headlineLarge: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.2,
  } as TextStyle,
  
  headlineMedium: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.1,
  } as TextStyle,
  
  headlineSmall: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: 0,
  } as TextStyle,
  
  // Titles
  titleLarge: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: 0,
  } as TextStyle,
  
  titleMedium: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.1,
  } as TextStyle,
  
  titleSmall: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.1,
  } as TextStyle,
  
  // Body text
  bodyLarge: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.2,
  } as TextStyle,
  
  bodyMedium: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.2,
  } as TextStyle,
  
  bodySmall: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
  } as TextStyle,
  
  // Labels - for buttons, inputs, badges
  labelLarge: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.3,
  } as TextStyle,
  
  labelMedium: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.4,
  } as TextStyle,
  
  labelSmall: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.5,
  } as TextStyle,
  
  // Caption - smallest readable text (12sp minimum for accessibility)
  caption: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  } as TextStyle,
  
  // Overline - uppercase labels
  overline: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } as TextStyle,
} as const

/**
 * Helper to create a style with the custom font
 * Falls back gracefully if font not loaded
 */
export function withFont(
  weight: keyof typeof fonts = 'regular',
  size: number = 15,
  lineHeight?: number
): TextStyle {
  return {
    fontFamily: fonts[weight],
    fontSize: size,
    lineHeight: lineHeight ?? Math.round(size * 1.5),
  }
}
