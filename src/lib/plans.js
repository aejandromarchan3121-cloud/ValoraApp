export const FEATURES = {
  lite: ['inventory', 'cash', 'rates'],
  full: ['inventory', 'cash', 'rates', 'emergency', 'ai', 'analytics'],
};
export const PLAN_LABEL = { lite: 'Lite', full: 'Full' };
export const hasFeature = (plan, feature) => (FEATURES[plan] ?? FEATURES.lite).includes(feature);