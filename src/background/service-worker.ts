/**
 * Thockify Chrome Extension - Service Worker
 * Handles extension lifecycle, settings, and keyboard shortcuts
 */

import { StorageManager } from '../utils/storage';
import { MESSAGE_TYPES } from '../utils/constants';

// Extension installation and startup handler
chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason === 'install') {
    // Initialize default settings on first install
    await StorageManager.resetSettings();
    console.log('Thockify installed with default settings');
  } else if (details.reason === 'update') {
    // Handle extension updates
    console.log(
      'Thockify updated to version',
      chrome.runtime.getManifest().version
    );
  }

  // Inject content script into all existing tabs
  await injectIntoExistingTabs();
});

// Handle browser startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Thockify: Browser started, injecting into existing tabs');
  await injectIntoExistingTabs();
});

// Handle new tab creation
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only inject when the tab is completely loaded and has a valid URL
  if (
    changeInfo.status === 'complete' &&
    tab.url &&
    (tab.url.startsWith('http://') || tab.url.startsWith('https://'))
  ) {
    await injectIntoTab(tabId);
  }
});

/**
 * Inject content script into all existing tabs
 */
async function injectIntoExistingTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    const injectionPromises = tabs
      .filter(
        tab =>
          tab.id &&
          tab.url &&
          (tab.url.startsWith('http://') || tab.url.startsWith('https://'))
      )
      .map(tab => injectIntoTab(tab.id!));

    await Promise.allSettled(injectionPromises);
    console.log(
      `Thockify: Attempted injection into ${injectionPromises.length} tabs`
    );
  } catch (error) {
    console.error('Failed to inject into existing tabs:', error);
  }
}

/**
 * Inject content script into a specific tab
 */
async function injectIntoTab(tabId: number): Promise<void> {
  try {
    // Check if content script is already injected
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.hasOwnProperty('thockifyContentScript'),
    });

    // Only inject if not already present
    if (!results[0]?.result) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-script.js'],
      });
      console.log(`Thockify: Injected into tab ${tabId}`);
    }
  } catch (error) {
    // Silently ignore injection failures (e.g., chrome:// pages, extensions pages)
    console.debug(`Failed to inject into tab ${tabId}:`, error);
  }
}

// Keyboard shortcuts handler
chrome.commands.onCommand.addListener(async command => {
  const settings = await StorageManager.getSettings();

  switch (command) {
    case 'toggle-extension':
      await StorageManager.setSetting('enabled', !settings.enabled);
      break;
    case 'volume-up':
      const newVolumeUp = Math.min(1.0, settings.volume + 0.1);
      await StorageManager.setSetting('volume', newVolumeUp);
      break;
    case 'volume-down':
      const newVolumeDown = Math.max(0.0, settings.volume - 0.1);
      await StorageManager.setSetting('volume', newVolumeDown);
      break;
    case 'toggle-mute':
      // Toggle between current volume and 0
      const targetVolume = settings.volume > 0 ? 0 : settings.lastVolume || 0.5;
      await StorageManager.setSetting('volume', targetVolume);
      break;
  }
});

// Message handling for communication with content scripts and popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case MESSAGE_TYPES.SETTINGS_GET:
      StorageManager.getSettings().then(sendResponse);
      return true; // Indicates async response

    case MESSAGE_TYPES.SETTINGS_UPDATE:
      StorageManager.updateSettings(message.updates)
        .then(() => sendResponse({ success: true }))
        .catch((error: Error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;

    default:
      console.warn('Unknown message type:', message.type);
      return false;
  }
});

// Storage change listener to broadcast updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    // Broadcast settings changes to all content scripts
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs
            .sendMessage(tab.id, {
              type: MESSAGE_TYPES.SETTINGS_CHANGED,
              changes,
            })
            .catch(() => {
              // Ignore errors for tabs without content scripts
            });
        }
      });
    });
  }
});
