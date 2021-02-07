"use strict";
$(function() {


    if (!window.indexedDB) {
        console.log("Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available.");
    }

    //main database to store projects
    var db_projects;
    var request = window.indexedDB.open("__DATA__", 1);
    console.log("db.open()!");

    request.onerror = function(event) {
      console.log("Why didn't you allow my web app to use IndexedDB?!");
      console.error("Database error: " + event.target.errorCode);
    };

    request.onupgradeneeded = function(event) {
      let db = event.target.result;
      console.log("onupgradeneeded!");
      let objectStore = db.createObjectStore("Projects", { keyPath: "name" });
      objectStore.createIndex("active", "active", { unique: false });

    };

    request.onsuccess = function(event) {
      console.log("db.success!");
      db_projects = event.target.result;
      initProjects();
    };






    browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
        //get current tab and retrieve url and complete some data
        let strUrl = tabs[0].url;
        let url = new URL(strUrl);
        if($.inArray(url.protocol, ["about:", "moz-extension:"])>=0) {
            $("#txtStartUrl").val("http://");
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
            active: true,
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

        console.log(data);

        var transaction = db_projects.transaction("Projects", "readwrite");

        var objectStore = transaction.objectStore("Projects");
        var request = objectStore.add(data);
        request.onsuccess = function(event) {
            window.close();
        };
    });

});
