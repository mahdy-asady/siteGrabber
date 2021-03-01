"use strict";

var BGConnection = browser.runtime.connect({name:"siteGrabberNew"});
BGConnection.onMessage.addListener(updateWindow);

function updateWindow(msg) {
    switch (msg.type) {
        case "ok":
            window.close();
            break;
        case "error":
            break;
    }
}

$(function() {
    browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
        //get current tab and retrieve url and complete some data
        let strUrl = tabs[0].url;
        let url = new URL(strUrl);
        if($.inArray(url.protocol, ["about:", "moz-extension:"])>=0) {
            $("#txtStartUrl").val("https://");
            return;
        }

        $("#txtStartUrl").val(strUrl);
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
        $("#txtDomain").val("https://");
        $("#wAddDomain").css("display", "none");
    });

    $("#btnAddDomainSave").click(function(){
        let url = new URL($("#txtDomain").val());
        $('#lstDomains').append(new Option(url.hostname, url.hostname));
        $("#txtDomain").val("https://");
        $("#wAddDomain").css("display", "none");
    });



    $("#btnCancel").click(function(){
        window.close();
    });

    $("#btnManagerWindow").click(function(){
        openManager().finally(() => {window.close();});
    });


    $("#btnSave").click(function() {
        //check if hostname of initial page is in lstDomains
        let url = new URL($("#txtStartUrl").val());
        url.hash = "";
        var hasSelfDomain = $("#lstDomains option[value='" + url.hostname + "']").length;
        if(!hasSelfDomain) {
            if(!confirm("The initial url's domain is not added to Allowed Domains list.\nAdd it and continue?")) return;

            $('#lstDomains').append(new Option(url.hostname, url.hostname));
        }

        var data = {
            name:               $("#txtName").val(),
            firstLink:          url.href,
            isActive:             $("#chkActive").is(":checked"),
            config: {
                whiteList:      [],
                downloadLimit:  $("#txtConcurrentLimit").val(),
                maxSize:        $("#txtMaxFileSize").val(),
                lifeTime:       $("#txtIndexAge").val()
            }
        };
        $("#lstDomains > option").each(function() {
            data.config.whiteList.push(this.value);
        });

        BGConnection.postMessage({
            type: "new",
            data: data
        });
    });
});
