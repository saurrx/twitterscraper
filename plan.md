
## Extract Mode Implementation Plan

### Feature Overview
Extract Mode will continuously capture tweet text and author username as the user scrolls through Twitter/X, auto-saving every 20 tweets to chrome.storage.local and allowing multiple JSON downloads.

### Technical Architecture

#### 1. **Data Structure**
```javascript
// In-memory buffer
extractBuffer = {
  tweets: [],
  sessionId: Date.now(),
  startTime: new Date().toISOString()
};

// Tweet object structure
{
  text: "Tweet content here...",
  author: "username123",
  extractedAt: "2025-07-30T10:30:00Z"
}

// Saved batch structure in chrome.storage.local
{
  extract_batch_[sessionId]_[batchNumber]: {
    batchNumber: 1,
    tweets: [...], // 20 tweets
    savedAt: "2025-07-30T10:30:00Z"
  }
}
```

#### 2. **File Modifications**

**A. content.js** - Add ExtractMode class
```javascript
class ExtractMode {
  constructor() {
    this.isExtracting = false;
    this.extractBuffer = [];
    this.observer = null;
    this.sessionId = null;
    this.batchNumber = 0;
    this.totalExtracted = 0;
  }

  start() {
    // Initialize session
    // Set up MutationObserver
    // Start observing tweet containers
  }

  stop() {
    // Save remaining buffer
    // Disconnect observer
    // Reset state
  }

  extractTweet(tweetElement) {
    // Parse tweet text and author
    // Add to buffer
    // Check if buffer >= 20, then save
  }

  saveBuffer() {
    // Save to chrome.storage.local
    // Clear buffer
    // Increment batch number
    // Send stats update to popup
  }

  downloadData() {
    // Compile all batches
    // Generate JSON
    // Trigger download
  }
}
```

**B. popup.html** - Add Extract Mode UI
```html
<!-- Add to controls section -->
<div class="extract-controls">
  <button id="extractBtn" class="extract-btn">
    <span class="extract-icon">📊</span> Extract Mode
  </button>
</div>

<!-- Add stats display -->
<div id="extractStats" class="extract-stats" style="display: none;">
  <h3>Extraction Stats</h3>
  <p>Tweets Captured: <span id="tweetCount">0</span></p>
  <p>Batches Saved: <span id="batchCount">0</span></p>
  <button id="downloadBtn" class="download-btn">Download JSON</button>
</div>
```

**C. popup.js** - Add Extract Mode controls
```javascript
// Add extract mode handling
let extractMode = false;

extractBtn.addEventListener('click', toggleExtractMode);
downloadBtn.addEventListener('click', downloadExtractedData);

function toggleExtractMode() {
  // Send message to content script
  // Update UI state
  // Show/hide stats
}

function updateExtractStats(stats) {
  // Update UI with current stats
}
```

**D. background.js** - Add message handling
```javascript
// Add extract mode message handling
if (request.action === 'extractStats') {
  // Relay stats to popup
}

if (request.action === 'downloadReady') {
  // Handle download coordination
}
```

#### 3. **Implementation Details**

**Tweet Extraction Logic:**
```javascript
extractTweet(tweetElement) {
  // Find text content
  const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
  const text = textElement ? textElement.textContent.trim() : '';
  
  // Find author
  const authorElement = tweetElement.querySelector('a[href^="/"] > div > span');
  const author = authorElement ? authorElement.textContent.replace('@', '') : '';
  
  // Add to buffer
  this.extractBuffer.push({
    text,
    author,
    extractedAt: new Date().toISOString()
  });
  
  // Auto-save check
  if (this.extractBuffer.length >= 20) {
    this.saveBuffer();
  }
}
```

**MutationObserver Setup:**
```javascript
setupObserver() {
  const targetNode = document.querySelector('main');
  const config = { childList: true, subtree: true };
  
  this.observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          const tweets = node.querySelectorAll('article[data-testid="tweet"]');
          tweets.forEach(tweet => this.extractTweet(tweet));
        }
      });
    });
  });
  
  this.observer.observe(targetNode, config);
}
```

**Download Implementation:**
```javascript
async downloadData() {
  // Get all batches from storage
  const keys = await chrome.storage.local.get(null);
  const batches = Object.keys(keys)
    .filter(key => key.startsWith(`extract_batch_${this.sessionId}`))
    .map(key => keys[key]);
  
  // Compile all tweets
  const allTweets = batches.flatMap(batch => batch.tweets);
  allTweets.push(...this.extractBuffer); // Add current buffer
  
  // Create JSON
  const exportData = {
    metadata: {
      sessionId: this.sessionId,
      extractionStart: this.startTime,
      extractionEnd: new Date().toISOString(),
      totalTweets: allTweets.length,
      url: window.location.href
    },
    tweets: allTweets
  };
  
  // Trigger download
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  chrome.runtime.sendMessage({
    action: 'download',
    url: url,
    filename: `twitter-extract-${timestamp}.json`
  });
}
```

#### 4. **CSS Additions**
```css
/* Extract mode styles for popup.css */
.extract-btn {
  background-color: #17bf63;
  color: white;
  width: 100%;
  margin-top: 10px;
}

.extract-btn.active {
  background-color: #e0245e;
}

.extract-stats {
  background-color: #f7f9fa;
  padding: 15px;
  border-radius: 5px;
  margin-top: 15px;
}

.download-btn {
  background-color: #794bc4;
  color: white;
  width: 100%;
  margin-top: 10px;
}
```

#### 5. **State Management**
- Use chrome.storage.local for persistence across page reloads
- Maintain extraction state in content script
- Sync UI state with actual extraction state

#### 6. **Error Handling**
- Handle storage quota exceeded
- Handle missing tweet elements gracefully
- Validate data before saving

#### 7. **Performance Considerations**
- Throttle MutationObserver callbacks if needed
- Limit storage usage (implement rotation after X batches)
- Use efficient selectors for tweet extraction

### Testing Checklist
- [ ] Extract mode starts/stops correctly
- [ ] Tweets are captured accurately
- [ ] Auto-save triggers at 20 tweets
- [ ] Multiple downloads work correctly
- [ ] Stats update in real-time
- [ ] Persistence across page reloads
- [ ] Memory cleanup on stop

This plan provides a complete implementation roadmap while maintaining the existing warming functionality. The senior engineer can implement each component independently and test incrementally.