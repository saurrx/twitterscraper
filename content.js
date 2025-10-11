// Twitter Warmer Content Script
console.log('Twitter Warmer: Content script loaded');

// ---- ExtractMode Implementation ----
class ExtractMode {
  constructor() {
    this.isExtracting = false;
    this.extractBuffer = [];
    this.observer = null;
    this.sessionId = null;
    this.batchNumber = 0;
    this.totalExtracted = 0;
    this.scrollInterval = null;
    this.lastScrollPosition = 0;
  }

  start() {
    if (this.isExtracting) return;
    this.isExtracting = true;
    this.sessionId = Date.now();
    this.batchNumber = 0;
    this.extractBuffer = [];
    this.totalExtracted = 0;
    // Persist sessionId and batchNumber
    chrome.storage.local.set({
      extract_lastSessionId: this.sessionId,
      extract_lastBatchNumber: this.batchNumber
    });
    this.observeTweets();
    this.startScrolling();
    console.log('[ExtractMode] Started extraction.');
  }

  stop() {
    if (!this.isExtracting) return;
    this.isExtracting = false;
    if (this.observer) this.observer.disconnect();
    if (this.scrollInterval) {
      clearTimeout(this.scrollInterval);
      this.scrollInterval = null;
    }
    this.saveBuffer();
    // Persist sessionId and batchNumber
    chrome.storage.local.set({
      extract_lastSessionId: this.sessionId,
      extract_lastBatchNumber: this.batchNumber
    });
    this.extractBuffer = [];
    console.log('[ExtractMode] Stopped extraction.');
  }

  observeTweets() {
    // Observe tweet containers for new tweets
    this.observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            this.tryExtractFromNode(node);
          }
        }
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    // Initial extraction
    this.extractFromAllTweets();
  }

  tryExtractFromNode(node) {
    // Check if node is a tweet or contains tweets
    if (this.isTweetNode(node)) {
      this.extractTweet(node);
    } else {
      const tweets = node.querySelectorAll && node.querySelectorAll('article[data-testid="tweet"], [data-testid="tweet"], article[role="article"]');
      if (tweets && tweets.length) {
        tweets.forEach(tweet => this.extractTweet(tweet));
      }
    }
  }

  startScrolling() {
    if (!this.isExtracting) return;
    const scrollDelay = this.getRandomDelay(1000, 3000); // 1-3 seconds (faster)
    this.scrollInterval = setTimeout(() => {
      this.performScroll();
      this.startScrolling(); // Schedule next scroll
    }, scrollDelay);
  }

  performScroll() {
    if (!this.isExtracting) return;
    const scrollDistance = Math.random() * 600 + 200; // 200-800px
    window.scrollBy({
      top: scrollDistance,
      behavior: 'smooth'
    });
    this.lastScrollPosition = window.pageYOffset;
    // Optionally, log for debugging
    // console.log(`[ExtractMode] Scrolled ${Math.round(scrollDistance)}px`);
  }

  getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  extractFromAllTweets() {
    const tweets = document.querySelectorAll('article[data-testid="tweet"], [data-testid="tweet"], article[role="article"]');
    tweets.forEach(tweet => this.extractTweet(tweet));
  }

  isTweetNode(node) {
    return (
      node.matches &&
      (node.matches('article[data-testid="tweet"]') ||
        node.matches('[data-testid="tweet"]') ||
        node.matches('article[role="article"]'))
    );
  }

  extractTweet(tweetElement) {
    if (!this.isExtracting) return;
    // Parse tweet text and author
    const text = this.getTweetText(tweetElement);
    const author = this.getTweetAuthor(tweetElement);
    const tweetId = this.getTweetId(tweetElement);
    // Parse tweet posted timestamp
    let tweetTimestamp = '';
    const timeElem = tweetElement.querySelector('time');
    if (timeElem && timeElem.getAttribute('datetime')) {
      tweetTimestamp = timeElem.getAttribute('datetime');
    }
    if (!text || !author || !tweetId) return;
    // Prevent duplicates
    if (this.extractBuffer.some(t => t.id === tweetId)) return;
    // Compose tweet object
    const tweetObj = {
      id: tweetId,
      text,
      author,
      tweetTimestamp,
      extractedAt: new Date().toISOString()
    };
    this.extractBuffer.push(tweetObj);
    this.totalExtracted++;
    // Save every 20 tweets
    if (this.extractBuffer.length >= 20) {
      this.saveBuffer();
    }
    // Optionally, send stats to popup
    chrome.runtime.sendMessage({
      action: 'extractStats',
      tweetCount: this.totalExtracted,
      batchCount: this.batchNumber
    });
  }

  saveBuffer() {
    if (!this.extractBuffer.length) return;
    const batchKey = `extract_batch_${this.sessionId}_${this.batchNumber}`;
    const batch = {
      batchNumber: this.batchNumber,
      tweets: [...this.extractBuffer],
      savedAt: new Date().toISOString()
    };
    chrome.storage.local.set({ [batchKey]: batch });
    this.extractBuffer = [];
    this.batchNumber++;
    chrome.runtime.sendMessage({
      action: 'extractStats',
      tweetCount: this.totalExtracted,
      batchCount: this.batchNumber
    });
  }

  async downloadData() {
    // Use current sessionId if extracting, otherwise get last sessionId from storage
    let sessionId = this.isExtracting ? this.sessionId : null;
    if (!sessionId) {
      const storage = await new Promise(resolve => chrome.storage.local.get(['extract_lastSessionId'], resolve));
      sessionId = storage.extract_lastSessionId;
    }
    if (!sessionId) {
      alert('No extraction session found.');
      return;
    }
    // Get all batches for this session
    const all = await new Promise(resolve => chrome.storage.local.get(null, resolve));
    const batches = Object.keys(all)
      .filter(k => k.startsWith(`extract_batch_${sessionId}_`))
      .map(k => all[k]);
    const json = JSON.stringify(batches, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = `twitter_extract_${sessionId}.json`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  getTweetText(tweetElement) {
    // Try to find tweet text
    const textNode = tweetElement.querySelector('div[lang]');
    return textNode ? textNode.innerText.trim() : '';
  }

  getTweetAuthor(tweetElement) {
    // Try to find username (could be @ handle or display name)
    const userNode = tweetElement.querySelector('a[href*="/status/"] span, div[dir="ltr"] > span');
    return userNode ? userNode.innerText.trim() : '';
  }

  getTweetId(tweetElement) {
    const link = tweetElement.querySelector('a[href*="/status/"]');
    if (link) {
      const href = link.getAttribute('href');
      const match = href.match(/\/status\/(\d+)/);
      return match ? match[1] : null;
    }
    return null;
  }
}

// ExtractMode singleton
const extractMode = new ExtractMode();

// Listen for messages for ExtractMode
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startExtract') {
    extractMode.start();
    sendResponse({ status: 'extracting' });
  } else if (request.action === 'stopExtract') {
    extractMode.stop();
    sendResponse({ status: 'stopped' });
  } else if (request.action === 'downloadExtract') {
    extractMode.downloadData();
    sendResponse({ status: 'downloaded' });
  } else if (request.action === 'getExtractStats') {
    sendResponse({
      tweetCount: extractMode.totalExtracted,
      batchCount: extractMode.batchNumber,
      isExtracting: extractMode.isExtracting
    });
  }
});

// ---- End ExtractMode Implementation ----
// Existing TwitterWarmer follows below


class TwitterWarmer {
  constructor() {
    this.isRunning = false;
    this.scrollInterval = null;
    this.likeInterval = null;
    this.lastScrollPosition = 0;
    this.tweetsProcessed = new Set();
    
    // Initialize
    this.init();
  }
  
  init() {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'start') {
        this.start();
        sendResponse({status: 'started'});
      } else if (request.action === 'stop') {
        this.stop();
        sendResponse({status: 'stopped'});
      } else if (request.action === 'getStatus') {
        sendResponse({status: this.isRunning ? 'running' : 'stopped'});
      }
    });
    
    // Check if we should auto-start (if user left it running)
    chrome.storage.local.get(['isRunning'], (result) => {
      if (result.isRunning) {
        this.start();
      }
    });
  }
  
  start() {
    if (this.isRunning) return;
    
    console.log('Twitter Warmer: Starting...');
    this.isRunning = true;
    chrome.storage.local.set({isRunning: true});
    
    // Start scrolling
    this.startScrolling();
    
    // Start liking (less frequent than scrolling)
    this.startLiking();
  }
  
  stop() {
    if (!this.isRunning) return;
    
    console.log('Twitter Warmer: Stopping...');
    this.isRunning = false;
    chrome.storage.local.set({isRunning: false});
    
    // Clear intervals
    if (this.scrollInterval) {
      clearTimeout(this.scrollInterval);
      this.scrollInterval = null;
    }
    
    if (this.likeInterval) {
      clearTimeout(this.likeInterval);
      this.likeInterval = null;
    }
  }
  
  startScrolling() {
    if (!this.isRunning) return;
    
    const scrollDelay = this.getRandomDelay(3000, 8000); // 3-8 seconds
    
    this.scrollInterval = setTimeout(() => {
      this.performScroll();
      this.startScrolling(); // Schedule next scroll
    }, scrollDelay);
  }
  
  startLiking() {
    if (!this.isRunning) return;
    
    const likeDelay = this.getRandomDelay(15000, 45000); // 15-45 seconds
    
    this.likeInterval = setTimeout(() => {
      this.performLike();
      this.startLiking(); // Schedule next like
    }, likeDelay);
  }
  
  performScroll() {
    if (!this.isRunning) return;
    
    const scrollDistance = Math.random() * 600 + 200; // 200-800px
    const currentPosition = window.pageYOffset;
    
    // Smooth scroll
    window.scrollBy({
      top: scrollDistance,
      behavior: 'smooth'
    });
    
    console.log(`Twitter Warmer: Scrolled ${Math.round(scrollDistance)}px`);
    this.lastScrollPosition = window.pageYOffset;
  }
  
  performLike() {
    if (!this.isRunning) return;
    
    // Find tweets on screen
    const tweets = this.findTweets();
    const availableTweets = tweets.filter(tweet => this.canLikeTweet(tweet));
    
    if (availableTweets.length === 0) {
      console.log('Twitter Warmer: No tweets available to like');
      return;
    }
    
    // Select random tweet
    const randomTweet = availableTweets[Math.floor(Math.random() * availableTweets.length)];
    const likeButton = this.findLikeButton(randomTweet);
    
    if (likeButton && !this.isAlreadyLiked(likeButton)) {
      // Add some delay before clicking
      setTimeout(() => {
        likeButton.click();
        console.log('Twitter Warmer: Liked a tweet');
        
        // Mark this tweet as processed
        const tweetId = this.getTweetId(randomTweet);
        if (tweetId) {
          this.tweetsProcessed.add(tweetId);
        }
      }, this.getRandomDelay(500, 2000));
    }
  }
  
  findTweets() {
    // Twitter/X uses different selectors, try multiple approaches
    const selectors = [
      'article[data-testid="tweet"]',
      '[data-testid="tweet"]',
      'article[role="article"]'
    ];
    
    for (const selector of selectors) {
      const tweets = document.querySelectorAll(selector);
      if (tweets.length > 0) {
        return Array.from(tweets);
      }
    }
    
    return [];
  }
  
  canLikeTweet(tweet) {
    // Basic checks
    if (!tweet) return false;
    
    // Check if tweet is in viewport
    const rect = tweet.getBoundingClientRect();
    const isVisible = rect.top >= 0 && rect.top <= window.innerHeight;
    
    if (!isVisible) return false;
    
    // Check if already processed
    const tweetId = this.getTweetId(tweet);
    if (tweetId && this.tweetsProcessed.has(tweetId)) {
      return false;
    }
    
    return true;
  }
  
  findLikeButton(tweet) {
    // Try different selectors for like button
    const selectors = [
      '[data-testid="like"]',
      '[aria-label*="Like"]',
      '[aria-label*="like"]'
    ];
    
    for (const selector of selectors) {
      const button = tweet.querySelector(selector);
      if (button) return button;
    }
    
    return null;
  }
  
  isAlreadyLiked(likeButton) {
    // Check if tweet is already liked (button state)
    const ariaLabel = likeButton.getAttribute('aria-label') || '';
    return ariaLabel.toLowerCase().includes('liked') || 
           ariaLabel.toLowerCase().includes('unlike');
  }
  
  getTweetId(tweet) {
    // Try to get unique identifier for tweet
    const link = tweet.querySelector('a[href*="/status/"]');
    if (link) {
      const href = link.getAttribute('href');
      const match = href.match(/\/status\/(\d+)/);
      return match ? match[1] : null;
    }
    return null;
  }
  
  getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new TwitterWarmer();
  });
} else {
  new TwitterWarmer();
}