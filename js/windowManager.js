"use strict";

var animateStart;
function doAnimate() {
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
    }
}, 1000);
