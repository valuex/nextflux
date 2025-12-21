// Local storage for feed-specific preferences that aren't supported by Miniflux API

const STORAGE_KEY = 'feedPreferences';

// Get all feed preferences
export const getFeedPreferences = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error reading feed preferences:', error);
    return {};
  }
};

// Get preference for a specific feed
export const getFeedPreference = (feedId) => {
  const prefs = getFeedPreferences();
  return prefs[feedId] || {};
};

// Set preference for a specific feed
export const setFeedPreference = (feedId, preferences) => {
  try {
    const prefs = getFeedPreferences();
    prefs[feedId] = { ...prefs[feedId], ...preferences };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.error('Error saving feed preferences:', error);
  }
};

// Remove preference for a specific feed
export const removeFeedPreference = (feedId) => {
  try {
    const prefs = getFeedPreferences();
    delete prefs[feedId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.error('Error removing feed preferences:', error);
  }
};
