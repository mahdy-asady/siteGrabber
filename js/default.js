"use strict";
initDB(function(){});

var activeProject; //current active dispay project

var BGConnection = browser.runtime.connect({name:"siteGrabber"});
BGConnection.onMessage.addListener(updateWindow);

function updateWindow(msg) {
    switch (msg.type) {
        case "Pages":
            updatePages(msg);
            break;
        case "Projects":
            updateProjects(msg);
            break;
    }

}

function updatePages(msg) {
    if(activeProject == msg.pid) {
        $("#activePages").find("tr:gt(0)").remove();

        msg.jobs.forEach((item, i) => {
            let status = (item.status<40)? "Downloading":(item.status<50)? "Saving":(item.status<100)? "Get links":"Complete";

            $("#activePages").append(`<tr>
                <td>${status}</td>
                <td>${item.path}</td>
                <td><div class="w3-light-grey"><div class="w3-red w3-center w3-text-black" style="width:${item.status}%">${item.status}%</div></div></td>
                <td>skip &nbsp Pause</td>
                </tr>`);
        });
    }
}


function updateProjects(msg) {
    $("#projects").empty();
    msg.projects.forEach((item, i) => {
        $("#projects").append(`<li data-pid="${item.pid}" data-isActive="${item.isActive}" class="w3-padding-16 w3-hover-light-grey"><img src="/style/web-32.png" class="w3-padding-small">${item.name}${(!item.isActive)? "(Paused)":""}</li>`);
    });

    if(msg.projects.length == 0)
        updateProjects.hasExecuted = 0;
    else if(!updateProjects.hasExecuted) {
        $(".project-list ul li:first-child").click();
        updateProjects.hasExecuted = 1;
    }
    else {
        highlightActiveProject();
    }
}




function highlightActiveProject() {
    $(".project-list ul li").removeClass("w3-green w3-hover-light-green");
    $(".project-list ul li").addClass("w3-hover-light-grey");

    $(".project-list ul li").each(function(){
        if($(this).data().pid == activeProject) {
            $(this).addClass("w3-green w3-hover-light-green");
            $(this).removeClass("w3-hover-light-grey");

            //change pause/resume button text
            if($(this).data().isactive) {
                $("#projectPause").text("Pause Project");
            } else {
                $("#projectPause").text("Resume Project");
            }
        }
    });
};

$(".project-list ul").on("click", "li", function(){
    if(activeProject != $(this).data().pid) {
        //set active project id
        activeProject = $(this).data().pid;
        //clean data tables...
        $("#activePages").find("tr:gt(0)").remove();
        //highlight the left menu item
        highlightActiveProject();
    }
});

$("#projectPause").click(function() {
    BGConnection.postMessage({
        type:"toggleActivate",
        pid: activeProject
    });
});

$("#projectDelete").click(function() {
    if((activeProject != undefined) && confirm("this action could not be undone?\nAre you sure?")) {//show to user how much data was downloaded and get confirm that user has exported them
        BGConnection.postMessage({
            type:"Delete",
            pid: activeProject
        });
    }
});

$("#addProject").click(function () {
    browser.browserAction.openPopup();
});


$("#projectExport").click(function(){
    $("#wExport").css("display", "block");
    doExport();
});

$("#wExportCancel").click(function() {
    // TODO: Cancel the job
    $("#projectExport").css("display", "none");
});

function doExport(){
    var request = db.transaction("Projects").objectStore("Projects").get(activeProject);

    request.onsuccess = function(event) {
        // Do something with the request.result!
        let pName = request.result.name;

        let index = db.transaction("Pages").objectStore("Pages").index("pid");
        //create jsZip
        let zip = new JSZip();
        //create a root folder based on project name and store all files in it
        let root = zip.folder(pName);

        index.openCursor(IDBKeyRange.only(activeProject)).onsuccess = function(event) {
            let cursor = event.target.result;
            if (cursor) {
                if(cursor.value.time) {//just save files that has been scanned at last 1.
                    let url = cursor.value.path;
                    //first remove protocol
                    url = url.slice(url.indexOf("://")+3);
                    // TODO: remove prohbited characters

                    $("#counter").text(url);
                    //adding files to zip
                    root.file(url, cursor.value.content);
                }
                cursor.continue();
            }
            else {
                //saving file
                zip.generateAsync({type:"blob"})
                    .then(function(content) {
                        // see FileSaver.js
                        saveAs(content, pName + ".zip");
                        $("#projectExport").css("display", "none");
                    });
            }
        };

    };


}
