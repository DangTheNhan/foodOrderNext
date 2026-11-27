import { useRef } from 'react';
import { Animated, useWindowDimensions } from 'react-native';

/**
 * Custom hook to abstract all animation logic for the Onboarding Screen.
 * Keeping this logic out of the presentation component ensures strict separation of concerns
 * and allows for easy unit testing of animation ranges.
 */
export const useOnboardingAnimation = () => {
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;

  // Handles the onScroll event mapping for the FlatList
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false } // False because width interpolation doesn't support native driver
  );

  // Calculates dynamic width and opacity for pagination dots based on scroll position
  const getDotStyle = (index) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const dotWidth = scrollX.interpolate({
      inputRange,
      outputRange: [8, 24, 8],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.3, 1, 0.3],
      extrapolate: 'clamp',
    });

    return {
      width: dotWidth,
      opacity,
    };
  };

  return {
    scrollX,
    onScroll,
    getDotStyle,
    width,
  };
};
