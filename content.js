// YouTube transcript functionality
async function getYtVariables() {
  return new Promise(resolve => {
    const listener = (event) => {
      if (event.source === window && event.data?.type === 'put yt data') {
        const { clientVersion, device } = event.data.value;
        window.removeEventListener('message', listener);
        resolve({ clientVersion, device });
      }
    };

    window.addEventListener('message', listener);
    window.postMessage({ 'type': "get yt data" }, '*');
  });
}

async function getEnchantedUrl(url) {
  try {
    const data = await getYtVariables();
    const extraString = data.device;
    const clientVersion = data.clientVersion;

    const urlObject = new URL(url + '&' + extraString);
    urlObject.searchParams.set('fmt', 'json3');
    urlObject.searchParams.set('xorb', '2');
    urlObject.searchParams.set('xobt', '3');
    urlObject.searchParams.set('xovt', '3');
    urlObject.searchParams.set('c', 'Web');
    urlObject.searchParams.set('cplayer', 'UNIPLAYER');
    urlObject.searchParams.set('cver', clientVersion);

    urlObject.searchParams.delete('ceng');
    urlObject.searchParams.delete('cengver');

    return urlObject.toString();
  } catch (error) {
    console.error('Error getting enchanted URL:', error);
    return url;
  }
}

async function requestTranslationTextTry(url) {
  const response = await fetch(url);
  const json = await response.json();

  if (!Array.isArray(json.events) || !json.events.length) throw new Error('Empty data');

  let allEmpty = true;
  for (const item of json.events) {
    if (!Array.isArray(item.segs) || item.segs.length === 0) continue;

    for (const seg of item.segs) {
      if (seg.utf8 && seg.utf8.trim()) {
        allEmpty = false;
        break;
      }
    }
    if (!allEmpty) break;
  }

  if (allEmpty) throw new Error('Empty data');

  return json.events;
}

async function requestTranslationText(url) {
  let broken = false;

  try {
    return await requestTranslationTextTry(url);
  } catch (error) { }
  if (broken) return;

  await new Promise(resolve => { setTimeout(resolve, 5000); });

  try {
    return await requestTranslationTextTry(url);
  } catch (error) { }

  if (broken) return;

  await new Promise(resolve => { setTimeout(resolve, 10000); });

  try {
    return await requestTranslationTextTry(url);
  } catch (error) {
    throw new Error('Request failed');
  }
}

function adaptTranslationData(events) {
  const objects = [];
  for (const item of events) {
    if (!Array.isArray(item.segs) || item.segs.length === 0) continue;

    let segments = new Set();
    for (const seg of item.segs) {
      if (seg.utf8 && seg.utf8.trim()) segments.add(seg.utf8);
    }
    if (!segments.size) continue;

    let text = '';
    for (const part of segments) text += part;

    objects.push({
      start: item.tStartMs / 1000,
      duration: item.dDurationMs / 1000,
      text: text
    });
  }

  const output = [];
  let index = 0;
  let accumTexts = [];
  let startTime = 0;
  let length = 0;
  let timeInfo = {};
  let current = {};

  const resetVars = () => {
    index = 0;
    accumTexts = [];
    startTime = 0;
    length = 0;
    timeInfo = {};
  };

  objects.forEach((event, i, arr) => {
    if (current.start && current.text) {
      timeInfo.start = current.start;
      accumTexts.push(current.text);
      current = {};
    }

    if (index === 0) {
      timeInfo.start = current.start ? current.start : event.start;
    }
    index++;

    const roundedStart = Math.round(timeInfo.start);
    const roundedEventStart = Math.round(event.start);
    const timeDiff = roundedEventStart - roundedStart;
    length += event.text.length;
    accumTexts.push(event.text);

    if (i === arr.length - 1) {
      timeInfo.text = accumTexts.join(" ").replace(/\n/g, " ");
      output.push(timeInfo);
      resetVars();
      return;
    }

    if (timeDiff > 60) {
      timeInfo.text = accumTexts.join(" ").replace(/\n/g, " ");
      output.push(timeInfo);
      resetVars();
      return;
    }

    if (length > 300) {
      if (length < 500) {
        if (event.text.includes(".")) {
          const parts = event.text.split(".");
          if (parts[parts.length - 1].replace(/\s+/g, "") === "") {
            timeInfo.text = accumTexts.join(" ").replace(/\n/g, " ");
            output.push(timeInfo);
            resetVars();
            return;
          }

          const lastComplete = parts[parts.length - 2];
          const splitIndex = event.text.indexOf(lastComplete) + lastComplete.length + 1;
          const firstPart = event.text.substring(0, splitIndex);

          current.text = event.text.substring(splitIndex);
          current.start = event.start;
          accumTexts.splice(accumTexts.length - 1, 1, firstPart);
          timeInfo.text = accumTexts.join(" ").replace(/\n/g, " ");
          output.push(timeInfo);
          resetVars();
          return;
        }
        return;
      }

      timeInfo.text = accumTexts.join(" ").replace(/\n/g, " ");
      output.push(timeInfo);
      resetVars();
    }
  });

  return output;
}

async function getYoutubeTranscript() {
  const videoId = new URL(window.location.href).searchParams.get('v');
  if (!videoId) return null;

  try {
    // Get translation data
    const response = await fetch('https://www.youtube.com/watch?v=' + videoId);
    const text = await response.text();

    const jsonString = text.match(/\"captions\"\:([\s\S]+?)\,"videoDetails/)?.[1];
    if (!jsonString) return null;

    const translation = JSON.parse(jsonString)?.playerCaptionsTracklistRenderer;
    if (!translation || !translation.captionTracks || !translation.captionTracks.length) {
      return null;
    }

    // Get the first available caption track
    const track = translation.captionTracks.find(({ kind }) => kind !== 'asr') || translation.captionTracks[0];
    if (!track) return null;

    // Get the transcript data with enhanced URL
    const enhancedUrl = await getEnchantedUrl(track.baseUrl);
    const events = await requestTranslationText(enhancedUrl);

    if (!events || !events.length) return null;

    // Format the transcript using the adapted data
    let transcript = document.title + '\n' + window.location.href + '\n\nTranscript:\n';
    const adaptedEvents = adaptTranslationData(events);

    for (const event of adaptedEvents) {
      const time = Math.round(event.start);
      const minutes = Math.floor(time / 60);
      const seconds = String(time % 60).padStart(2, '0');

      transcript += `(${minutes}:${seconds}) ${event.text}\n`;
    }

    return transcript;
  } catch (error) {
    console.error('Error getting YouTube transcript:', error);
    return null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractArticle' || request.action === 'extractAndCopyArticle') {
    const text = extractArticleText();
    if (request.action === 'extractAndCopyArticle') {
      copyAndNotify(text);
      sendResponse({ success: true });
    } else {
      sendResponse({ text });
    }
  } else if (request.action === 'extractAllText' || request.action === 'extractAndCopyAllText') {
    const text = extractAllText();
    if (request.action === 'extractAndCopyAllText') {
      copyAndNotify(text);
      sendResponse({ success: true });
    } else {
      sendResponse({ text });
    }
  } else if (request.action === 'getYoutubeTranscript') {
    getYoutubeTranscript().then(transcript => {
      sendResponse({ transcript });
    });
    return true;
  } else if (request.action === 'copyYoutubeTranscript') {
    getYoutubeTranscript().then(transcript => {
      if (transcript) {
        copyAndNotify(transcript);
      } else {
        showNotification('No transcript available for this video');
      }
    });
    sendResponse({ success: true });
  } else if (request.action === 'copyText') {
    copyAndNotify(request.text);
    sendResponse({ success: true });
  } else if (request.action === 'showNotification') {
    showNotification(request.message);
    sendResponse({ success: true });
  }
  return true;
});

function extractArticleText() {
  const documentClone = document.cloneNode(true);
  const reader = new Readability(documentClone);
  const article = reader.parse();

  if (article) {
    return `Title: ${article.title}\n\n${article.textContent}`.replace(/[\r\n]{3,}/g, '\n\n').trim();
  }
  return extractAllText(); // Fallback to all text if article parsing fails
}

function extractAllText() {
  // Remove hidden elements
  const elements = document.querySelectorAll('body *');
  const visibleElements = Array.from(elements).filter(el => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  });

  // Extract text from visible elements
  let text = '';
  visibleElements.forEach(el => {
    if (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3') {
      text += `\n### ${el.innerText.trim()} ###\n`;
    } else if (el.tagName === 'P' || el.tagName === 'DIV' || el.tagName === 'SPAN') {
      const content = el.innerText.trim();
      if (content) text += content + '\n';
    }
  });

  // Clean up the text
  return text
    .replace(/[\r\n]{3,}/g, '\n\n')
    .replace(/\n\s+\n/g, '\n\n')
    .trim();
}

function copyAndNotify(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Content copied to clipboard!');
  });
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 16px;
    border-radius: 4px;
    z-index: 9999;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 2000);
}
