"use strict";
initDB(function(){});

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
        openManager().catch(() => {window.close();});
    });


    $("#btnSave").click(function() {
        //check if hostname of initial page is in lstDomains
        let url = new URL($("#txtStartUrl").val());
        var hasSelfDomain = $("#lstDomains option[value='" + url.hostname + "']").length;
        if(!hasSelfDomain) {
            if(!confirm("The initial url's domain is not added to Allowed Domains list.\nAdd it and continue?")) return;

            $('#lstDomains').append(new Option(url.hostname, url.hostname));
        }

        var data = {
            name: $("#txtName").val(),
            active: $("#chkActive").is(":checked"),
            config: {
                whiteList:[],
                downloadLimit: $("#txtConcurrentLimit").val(),
                maxSize: $("#txtMaxFileSize").val(),
                lifeTime: $("#txtIndexAge").val()
            }
        };
        $("#lstDomains > option").each(function() {
            data.config.whiteList.push(this.value);
        });


        var transaction = db_projects.transaction("Projects", "readwrite");

        var objectStore = transaction.objectStore("Projects");
        var request = objectStore.add(data);
        request.onsuccess = function(event) {
            //event.target.result
            let data ={
                pid: event.target.result,
                time: 0,
                path: $("#txtStartUrl").val()
            };

            var pgTransaction = db_projects.transaction("Pages", "readwrite");

            var Pages = pgTransaction.objectStore("Pages");
            var PagesRequest = Pages.add(data);
            PagesRequest.onsuccess = function(event) {window.close();};

        };
    });
});
