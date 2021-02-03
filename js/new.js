"use strict";
$(function() {

    browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
        let strUrl = tabs[0].url; // Safe to assume there will only be one result
        $("#txtStartUrl").val(strUrl);
        let url = new URL(strUrl);
        $("#txtName").val(url.hostname);
        $('#lstDomains').append(new Option(url.hostname, url.hostname));

    }, console.error);

    $("#btnDelDomain").click(function(){
        $('#lstDomains').find(":selected").remove();
    });

    $("#btnAddDomain").click(function(){
        $("#wAddDomain").css("display", "block");
    });

    $("#btnAddDomainCancel").click(function(){
        $("#txtDomain").val("http://");
        $("#wAddDomain").css("display", "none");
    });

    $("#btnAddDomainSave").click(function(){
        let url = new URL($("#txtDomain").val());
        $('#lstDomains').append(new Option(url.hostname, url.hostname));
        $("#txtDomain").val("http://");
        $("#wAddDomain").css("display", "none");
    });



    $("#btnCancel").click(function(){
        window.close();
    });

    $("#btnManagerWindow").click(function(){
        openManager().catch(() => {window.close();});
    });



});
