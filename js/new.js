"use strict";
$(function() {

    browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
        let strUrl = tabs[0].url; // Safe to assume there will only be one result
        $("#txtStartUrl").val(strUrl);
        let url = new URL(strUrl);
        $("#txtName").val(url.hostname);
        $('#lstDomains').append(new Option(url.hostname, url.hostname));

    }, console.error);


    $("#btnManagerWindow").click(function(){
        openManager().catch(() => {window.close();});
        console.log("After openManager");
        //window.close();
    });



});
