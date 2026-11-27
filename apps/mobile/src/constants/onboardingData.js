/**
 * This file acts as the single source of truth for the Onboarding screen content.
 * Decoupled content from UI component following Clean Architecture principles.
 */

export const ONBOARDING_DATA = [
  {
    id: '1',
    title: 'Discover Delicious Food',
    description: 'Explore thousands of dishes from your favorite restaurants and discover new flavors near you.',
    image: require('../assets/images/onboarding/onboarding_1.jpg')
  },
  {
    id: '2',
    title: 'Fast & Reliable Delivery',
    description: 'Track your order in real time and enjoy fast, secure delivery right to your doorstep.',
    image: require('../assets/images/onboarding/onboarding_2.jpg')
  },
  {
    id: '3',
    title: 'Easy Payments & Exclusive Deals',
    description: 'Pay securely, collect rewards, and enjoy exclusive vouchers every time you order.',
    image: require('../assets/images/onboarding/onboarding_3.jpg')
  }
];
