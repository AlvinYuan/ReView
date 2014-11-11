// To make sure we can uniquely identify each screenshot tab, add an id as a
// query param to the url that displays the screenshot.
// Note: It's OK that this is a global variable (and not in localStorage),
// because the event page will stay open as long as any screenshot tabs are
// open.
var id = 100;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.message && request.message == 'getClip') {
		console.log(request)
		chrome.tabs.captureVisibleTab(function(screenshotUrl) {
 			var viewTabUrl = chrome.extension.getURL('screenshot.html?id=' + id++)
    		var targetId = null;

		    chrome.tabs.onUpdated.addListener(function listener(tabId, changedProps) {
		    	// We are waiting for the tab we opened to finish loading.
		    	// Check that the tab's id matches the tab we opened,
		    	// and that the tab is done loading.
		    	if (tabId != targetId || changedProps.status != "complete")
		        	return;

		    	// Passing the above test means this is the event we were waiting for.
		    	// There is nothing we need to do for future onUpdated events, so we
		    	// use removeListner to stop getting called when onUpdated events fire.
		    	chrome.tabs.onUpdated.removeListener(listener);

		    	// Look through all views to find the window which will display
		    	// the screenshot.  The url of the tab which will display the
		    	// screenshot includes a query parameter with a unique id, which
		    	// ensures that exactly one view will have the matching URL.
		    	var views = chrome.extension.getViews();
		    	for (var i = 0; i < views.length; i++) {
		      		var view = views[i];
		        	if (view.location.href == viewTabUrl) {
		        		view.setScreenshot(screenshotUrl, request.dim);
		        		break;
		        	}
		        }
		    });

		    chrome.tabs.create({url: viewTabUrl}, function(tab) {
		      targetId = tab.id;
		    });
		});
	}
	return true;
});

chrome.browserAction.onClicked.addListener(function() {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
    	chrome.tabs.sendMessage(tabs[0].id, {message: "startClip"}, function(response) {});
	});
});
