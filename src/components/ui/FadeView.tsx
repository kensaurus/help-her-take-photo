/**
 * FadeView - Animated container with fade in/out transitions
 */

import { ReactNode } from 'react'
import { ViewStyle } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInUp,
  SlideOutDown,
  SlideOutUp,
  FadeInUp,
  FadeInDown,
  FadeOutUp,
  FadeOutDown,
} from 'react-native-reanimated'

type AnimationType = 
  | 'fade' 
  | 'slideUp' 
  | 'slideDown' 
  | 'fadeUp' 
  | 'fadeDown'

interface FadeViewProps {
  children: ReactNode
  entering?: AnimationType
  exiting?: AnimationType
  delay?: number
  duration?: number
  style?: ViewStyle
}

const enteringAnimations = {
  fade: (duration: number, delay: number) => FadeIn.duration(duration).delay(delay),
  slideUp: (duration: number, delay: number) => SlideInUp.duration(duration).delay(delay),
  slideDown: (duration: number, delay: number) => SlideInDown.duration(duration).delay(delay),
  fadeUp: (duration: number, delay: number) => FadeInUp.duration(duration).delay(delay),
  fadeDown: (duration: number, delay: number) => FadeInDown.duration(duration).delay(delay),
}

const exitingAnimations = {
  fade: (duration: number) => FadeOut.duration(duration),
  slideUp: (duration: number) => SlideOutUp.duration(duration),
  slideDown: (duration: number) => SlideOutDown.duration(duration),
  fadeUp: (duration: number) => FadeOutUp.duration(duration),
  fadeDown: (duration: number) => FadeOutDown.duration(duration),
}

export function FadeView({
  children,
  entering = 'fade',
  exiting = 'fade',
  delay = 0,
  duration = 300,
  style,
}: FadeViewProps) {
  return (
    <Animated.View
      entering={enteringAnimations[entering](duration, delay)}
      exiting={exitingAnimations[exiting](duration)}
      style={style}
    >
      {children}
    </Animated.View>
  )
}

/**
 * StaggeredFadeView - For lists with staggered animations
 */
interface StaggeredProps {
  children: ReactNode
  index: number
  staggerDelay?: number
  duration?: number
  style?: ViewStyle
}

export function StaggeredFadeView({
  children,
  index,
  staggerDelay = 50,
  duration = 400,
  style,
}: StaggeredProps) {
  return (
    <Animated.View
      entering={FadeInUp.duration(duration).delay(index * staggerDelay).springify()}
      exiting={FadeOutDown.duration(200)}
      style={style}
    >
      {children}
    </Animated.View>
  )
}

