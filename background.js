// Store requests for each tab
const tabRequests = new Map();

function httprequest(type, url, data, callback, callbackOnFailure,headers,doRaw) {
		var httpRequest = new XMLHttpRequest();

		if (!httpRequest) {
			alert('Cannot create an XMLHTTP instance');
			return false;
		}
		
		
		httpRequest.onreadystatechange = function (evt) {
			if (httpRequest.readyState != 4 || httpRequest.status != 200) {

				return;
			} else if (httpRequest.readyState === 4 && httpRequest.status > 399) {
				console.error("Error: " + httpRequest.status + " ");
				if (callbackOnFailure) {
					//eval(callback + '(httpRequest.responseText)');
					callbackOnFailure(httpRequest.responseText);
				}

			} else {
				//console.log(httpRequest.responseText);
				var data = httpRequest.responseText;
				console.log("On Ready State Change Rec'd ");
				console.log(JSON.stringify(evt));
				//  eval(callback + '(data)');
				if( doRaw ){
					callback(data);
				}
				else {
					callback(JSON.parse(data));
				}
			}
		};
		
		
		
		httpRequest.open(type, url);
		
		if( headers ){
				for(var i = 0;i < headers.length;i++){
					httpRequest.setRequestHeader(headers[i].name,headers[i].value);		
				}
		}
		
		if (type === "POST" || type === "PUT") {
			httpRequest.send(data);
		} else {
			httpRequest.send();
		}
	}

  function loadPopup(ctx){

    chrome.runtime.sendMessage({
      type: "PAGE_UPDATE",
      data: "loading " + ctx.url
     });
  }

let popupPort = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    popupPort = port;

    port.onDisconnect.addListener(() => {
      popupPort = null;
    });
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PAGE_UPDATE" && popupPort) {
    popupPort.postMessage({
      type: "UPDATE_POPUP",
      data: message.data
    });
  }
});

async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  // `tabs` is an array of tabs that match the criteria. Since we're looking for
  // the active tab in the last focused window, there will be only one tab in the array.
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

// Listen for web requests before they are sent
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { tabId, requestId, url, method, timeStamp, type } = details;
    
    if (tabId < 0) return; // Ignore requests not associated with a tab
    if( url.match(/\/solr\/[^\/]+\/select/) ){
       if (!tabRequests.has(tabId)) {
        tabRequests.set(tabId, new Map());
       }

       const requests = tabRequests.get(tabId);
       requests.set(requestId, {
                    id: requestId,
                    url: url,
                    method: method,
                    type: type,
                    timestamp: new Date(timeStamp).toISOString(),
                    status: 'pending',
                    statusCode: null,
                    responseHeaders: {},
                    requestHeaders: {}
                  });
    }
  },
  { urls: ["<all_urls>"] }
);

// Listen for request headers
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    const { tabId, requestId, requestHeaders } = details;
    
    if (tabId < 0) return;
    
    const requests = tabRequests.get(tabId);
    if (requests && requests.has(requestId)) {
      const request = requests.get(requestId);
      request.requestHeaders = requestHeaders || [];
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

// Listen for response headers
chrome.webRequest.onResponseStarted.addListener(
  (details) => {
    const { tabId, requestId, statusCode, responseHeaders } = details;
    
    if (tabId < 0) return;
    
    const requests = tabRequests.get(tabId);
    if (requests && requests.has(requestId)) {
      const request = requests.get(requestId);
      request.statusCode = statusCode;
      request.responseHeaders = responseHeaders || [];
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// Listen for completed requests
chrome.webRequest.onCompleted.addListener(
  (details) => {
    const { tabId, requestId, statusCode } = details;
    
    if (tabId < 0) return;
    
    const requests = tabRequests.get(tabId);
    if (requests && requests.has(requestId)) {
      const request = requests.get(requestId);
      request.status = 'completed';
      request.statusCode = statusCode;

      loadPopup({url: request.url});
    }
  },
  { urls: ["<all_urls>"] }
);

// Listen for failed requests
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    const { tabId, requestId, error } = details;
    
    if (tabId < 0) return;
    
    const requests = tabRequests.get(tabId);
    if (requests && requests.has(requestId)) {
      const request = requests.get(requestId);
      request.status = 'failed';
      request.error = error;
    }
  },
  { urls: ["<all_urls>"] }
);

// Clear requests when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabRequests.delete(tabId);
});

// Clear requests when navigating to a new page
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) { // Main frame only
    const requests = tabRequests.get(details.tabId);
    if (requests) {
      requests.clear();
    }
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getRequests') {
    const tabId = request.tabId;
    const requests = tabRequests.get(tabId);
    
    if (requests) {
      const requestArray = Array.from(requests.values());
      sendResponse({ requests: requestArray });
    } else {
      sendResponse({ requests: [] });
    }
    return true;
  }
  
  if (request.action === 'clearRequests') {
    const tabId = request.tabId;
    const requests = tabRequests.get(tabId);
    if (requests) {
      requests.clear();
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "PAGE_UPDATE" && popupPort) {
    popupPort.postMessage({
      type: "UPDATE_POPUP",
      data: request.data
    });
  }

});
