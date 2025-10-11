// Twitter Warmer Popup Script
document.addEventListener('DOMContentLoaded', function() {
    const statusDiv = document.getElementById('status');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const extractBtn = document.getElementById('extractBtn');
    const extractStats = document.getElementById('extractStats');
    const tweetCountSpan = document.getElementById('tweetCount');
    const batchCountSpan = document.getElementById('batchCount');
    const downloadBtn = document.getElementById('downloadBtn');
    let isExtracting = false;
    let onTwitter = false;

    // Check if we're on Twitter
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTab = tabs[0];
      
      if (!currentTab.url.includes('twitter.com') && !currentTab.url.includes('x.com')) {
        showNotOnTwitter();
        extractBtn.disabled = true;
        return;
      }
      onTwitter = true;
      // Get current status
      updateStatus();
      updateExtractStats();
    });

    // Extract Mode button click
    extractBtn.addEventListener('click', function() {
      if (!onTwitter) return;
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!isExtracting) {
          chrome.tabs.sendMessage(tabs[0].id, {action: 'startExtract'}, function(response) {
            isExtracting = true;
            extractBtn.textContent = 'Stop Extract';
            extractStats.style.display = 'block';
            updateExtractStats();
          });
        } else {
          chrome.tabs.sendMessage(tabs[0].id, {action: 'stopExtract'}, function(response) {
            isExtracting = false;
            extractBtn.textContent = 'Extract Mode';
            updateExtractStats();
          });
        }
      });
    });

    // Download button click
    downloadBtn.addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'downloadExtract'}, function(response) {
          // No UI update needed
        });
      });
    });

    // Poll extraction stats every 2 seconds
    setInterval(updateExtractStats, 2000);

    function updateExtractStats() {
      if (!onTwitter) return;
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getExtractStats'}, function(response) {
          if (chrome.runtime.lastError || !response) {
            extractStats.style.display = 'none';
            extractBtn.textContent = 'Extract Mode';
            isExtracting = false;
            return;
          }
          tweetCountSpan.textContent = response.tweetCount || 0;
          batchCountSpan.textContent = response.batchCount || 0;
          isExtracting = response.isExtracting;
          extractStats.style.display = isExtracting ? 'block' : 'none';
          extractBtn.textContent = isExtracting ? 'Stop Extract' : 'Extract Mode';
        });
      });
    }

    
    // Start button click
    startBtn.addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'start'}, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error:', chrome.runtime.lastError);
            showError('Failed to start. Make sure you\'re on Twitter and refresh the page.');
          } else {
            updateStatus();
          }
        });
      });
    });
    
    // Stop button click
    stopBtn.addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'stop'}, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error:', chrome.runtime.lastError);
          } else {
            updateStatus();
          }
        });
      });
    });
    
    function updateStatus() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getStatus'}, function(response) {
          if (chrome.runtime.lastError) {
            statusDiv.textContent = 'Status: Not Connected';
            statusDiv.className = 'status stopped';
            startBtn.disabled = true;
            stopBtn.disabled = true;
            return;
          }
          
          if (response && response.status === 'running') {
            statusDiv.textContent = 'Status: Running';
            statusDiv.className = 'status running';
            startBtn.disabled = true;
            stopBtn.disabled = false;
          } else {
            statusDiv.textContent = 'Status: Stopped';
            statusDiv.className = 'status stopped';
            startBtn.disabled = false;
            stopBtn.disabled = true;
          }
        });
      });
    }
    
    function showNotOnTwitter() {
      statusDiv.textContent = 'Please navigate to Twitter.com';
      statusDiv.className = 'status stopped';
      startBtn.disabled = true;
      stopBtn.disabled = true;
      extractBtn.disabled = true;
      extractStats.style.display = 'none';
      // Add instruction
      const instruction = document.createElement('div');
      instruction.style.cssText = `
        background-color: #e3f2fd;
        border: 1px solid #bbdefb;
        color: #1565c0;
        padding: 10px;
        border-radius: 5px;
        margin-top: 15px;
        font-size: 12px;
        text-align: center;
      `;
      instruction.innerHTML = `
        <strong>Instructions:</strong><br>
        1. Go to twitter.com or x.com<br>
        2. Open this popup again<br>
        3. Click Start to begin warming<br>
        4. Extract Mode only works on Twitter/X<br>
      `;
      document.body.appendChild(instruction);
    }
    
    function showError(message) {
      statusDiv.textContent = 'Status: Error';
      statusDiv.className = 'status stopped';
      
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        background-color: #ffebee;
        border: 1px solid #ffcdd2;
        color: #c62828;
        padding: 10px;
        border-radius: 5px;
        margin-top: 15px;
        font-size: 12px;
      `;
      errorDiv.textContent = message;
      document.body.appendChild(errorDiv);
    }
    
    // Update status every 2 seconds while popup is open
    setInterval(updateStatus, 2000);
  });