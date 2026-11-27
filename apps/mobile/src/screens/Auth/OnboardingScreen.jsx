import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../theme';
import { PrimaryButton, SecondaryButton } from '../../common';
import { ONBOARDING_DATA } from '../../constants/onboardingData';
import { useOnboardingAnimation } from '../../hooks/useOnboardingAnimation';
import { useAuthStore } from '../../stores/authStore';

// Render 3D illustration image in FlatList for a premium feel
const OnboardingSlide = React.memo(({ item, width }) => (
  <View style={[styles.slide, { width }]}>
    <View style={styles.imageContainer}>
      <Image
        source={item.image}
        style={styles.illustrationImage}
        resizeMode="contain"
      />
    </View>
  </View>
));

export const OnboardingScreen = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slidesRef = useRef(null);
  const { onScroll, getDotStyle, width } = useOnboardingAnimation();
  const completeOnboarding = useAuthStore(state => state.completeOnboarding);
  const insets = useSafeAreaInsets();

  const viewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleFinish = async () => {
    await completeOnboarding();
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'Auth',
          state: {
            index: 0,
            routes: [{ name: 'Login' }],
          },
        },
      ],
    });
  };

  const scrollToNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    }
  };

  const renderItem = useCallback(
    ({ item }) => {
      return <OnboardingSlide item={item} width={width} />;
    },
    [width],
  );

  const isLastSlide = currentIndex === ONBOARDING_DATA.length - 1;
  const currentSlide = ONBOARDING_DATA[currentIndex];

  return (
    <View style={styles.container}>
      {/* 1. Hero Illustration Carousel (~65% of screen height) */}
      <View
        style={[
          styles.illustrationSection,
          { paddingTop: Math.max(insets.top, Theme.spacing.l) },
        ]}
      >
        <FlatList
          data={ONBOARDING_DATA}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={item => item.id}
          onScroll={onScroll}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          scrollEventThrottle={32}
          ref={slidesRef}
          initialNumToRender={1}
          windowSize={3}
        />
      </View>

      {/* 2. Floating Content Card (~35% of screen height) */}
      <View
        style={[
          styles.cardWrapper,
          {
            paddingBottom:
              Math.max(insets.bottom, Theme.spacing.l) + Theme.spacing.l,
          },
        ]}
      >
        <View style={styles.contentCard}>
          <View style={styles.textContent}>
            <Text style={styles.title}>{currentSlide?.title}</Text>
            <Text style={styles.description}>{currentSlide?.description}</Text>
          </View>

          <View style={styles.indicatorContainer}>
            {ONBOARDING_DATA.map((_, i) => (
              <Animated.View
                key={i.toString()}
                style={[styles.dot, getDotStyle(i)]}
              />
            ))}
          </View>

          <View style={styles.buttonContainer}>
            {!isLastSlide ? (
              <>
                <SecondaryButton
                  title="Skip"
                  onPress={handleFinish}
                  style={styles.skipButton}
                  textStyle={styles.skipButtonText}
                />
                <PrimaryButton
                  title="Next"
                  onPress={scrollToNext}
                  style={styles.nextButton}
                />
              </>
            ) : (
              <PrimaryButton
                title="Get Started"
                onPress={handleFinish}
                style={styles.getStartedButton}
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },
  illustrationSection: {
    flex: 0.65,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  imageContainer: {
    width: '100%',
    height: '92%',
    borderRadius: Theme.radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
    borderRadius: Theme.radius.xl,
  },

  cardWrapper: {
    flex: 0.35,
    paddingHorizontal: Theme.spacing.l,
    justifyContent: 'flex-end',
  },
  contentCard: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    ...Theme.shadows.medium,
    width: '100%',
  },
  textContent: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  title: {
    ...Theme.typography.h1,
    fontWeight: '800',
    color: Theme.colors.text.primaryLight,
    textAlign: 'center',
    marginBottom: Theme.spacing.m,
  },
  description: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.colors.primary,
    marginHorizontal: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
  },
  skipButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
  },
  skipButtonText: {
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    height: 56,
    borderRadius: Theme.radius.pill,
    ...Theme.shadows.medium,
  },
  getStartedButton: {
    flex: 1,
    height: 56,
    borderRadius: Theme.radius.pill,
    ...Theme.shadows.medium,
  },
});
