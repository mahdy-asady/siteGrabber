
//set toolbar icon an action
/*browser.browserAction.onClicked.addListener((tab) => {
  // requires the "tabs" or "activeTab" permission
  openManager();
});*/



async function openManager() {
    let url = browser.runtime.getURL("/windows/default.html");
    const etabs = await browser.tabs.query({url});
    if (etabs.length) {
        const tab = etabs.pop();
        await browser.tabs.update(tab.id, { active: true });
        await browser.windows.update(tab.windowId, { focused: true });
        return;
    }

    const window = await browser.windows.getCurrent();
    await browser.tabs.create({
        active: true,
        url
    });
    await browser.windows.update(window.id, { focused: true });
}

async function sendMessage(msg) {
    let url = browser.runtime.getURL("/windows/default.html");
    const etabs = await browser.tabs.query({url});
    if (etabs.length) {
        const tab = etabs.pop();
        browser.tabs.sendMessage(tab.id, msg);
    }
}

var animateStart;
function doAnimate() {
    console.log("Animation set!");
    if(animateStart<(Date.now()-1000)) {
        //start animation
        browser.browserAction.setIcon({
            path: {
                16: "style/grabber-16.gif",
                32: "style/grabber-32.gif"
            }
        });

    }
    animateStart = Date.now();
}
setInterval(()=>{
    if(animateStart<(Date.now()-1000)) {
        //stop animation
        browser.browserAction.setIcon({path:"style/grabber.svg"});
        console.log("Icon set!");
    }
}, 1000);
