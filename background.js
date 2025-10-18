// This object will store a Set of video IDs (v) that have been
// refreshed, organized by the tab they were refreshed in.
// This prevents both infinite loops and ensures every new video
// in a playlist gets its required one-time refresh.
// Format: { tabId1: Set('videoId_A', 'videoId_B'), tabId2: Set('videoId_C') }
const refreshedVideosInTab = {};

/**
 * Listener to clean up our tracking object when a tab is closed.
 * This is good memory management.
 */
chrome.tabs.onRemoved.addListener((tabId) => {
    if (refreshedVideosInTab[tabId]) {
        delete refreshedVideosInTab[tabId];
    }
});

/**
 * The core logic for reloading a YouTube video page once per new video ID, per tab.
 * @param {object} details - Event details from the webNavigation API.
 */
function handleYouTubeNavigation(details) {
    // Only act on the main frame of the page.
    if (details.frameId !== 0) {
        return;
    }

    const url = new URL(details.url);
    const tabId = details.tabId;

    // We only care about YouTube "watch" pages.
    if (url.hostname === "www.youtube.com" && url.pathname === "/watch") {
        const videoId = url.searchParams.get('v');

        // If there's no video ID, we can't do anything.
        if (!videoId) {
            return;
        }

        // Initialize a Set for this tab if it's the first time we've seen it.
        if (!refreshedVideosInTab[tabId]) {
            refreshedVideosInTab[tabId] = new Set();
        }

        // The core logic: Has this specific video ID already been refreshed in this tab?
        if (!refreshedVideosInTab[tabId].has(videoId)) {
            // If not, we mark it as refreshed *before* we trigger the reload.
            // This is crucial to prevent the loop.
            refreshedVideosInTab[tabId].add(videoId);

            // Perform the one-time reload.
            chrome.tabs.reload(tabId, { bypassCache: true }, () => {
                if (chrome.runtime.lastError) {
                    // This error can happen if the tab is closed during the reload.
                    // It's safe to ignore.
                    /* console.log(chrome.runtime.lastError.message); */
                }
            });
        }
        // If the videoId is already in the Set, we do nothing.
    }
}

// Attach listeners for both full page loads (onCompleted) and dynamic
// navigations within YouTube (onHistoryStateUpdated).
chrome.webNavigation.onCompleted.addListener(handleYouTubeNavigation);
chrome.webNavigation.onHistoryStateUpdated.addListener(handleYouTubeNavigation);

