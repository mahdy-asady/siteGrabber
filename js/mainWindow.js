"use strict";

var activeProject = 0; //current active dispay project


var BGConnection = browser.runtime.connect({name:"siteGrabberMain"});
BGConnection.onMessage.addListener(updateWindow);

function doGetList() {
    BGConnection.postMessage({type:"list"});
    BGConnection.postMessage({type:"status", pid:activeProject});
}doGetList();

setInterval(()=>{doGetList()}, 500);


function updateWindow(msg) {
    switch (msg.type) {
        case "Pages":
            updatePages(msg);
            break;
        case "Status":
            updateProjectStatus(msg);
            break;
        case "Projects":
            updateProjects(msg);
            break;
        case "ExportStatus":
            updateExportStatus(msg);
            break;
        case "Export":
            saveFile(msg);
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
                </tr>`);
        });
    }
}

function updateProjectStatus(msg) {
    if(activeProject == msg.pid) {
        let percent = (msg.data.savedPages/msg.data.allPages*100).toFixed(2);
        $("#links-count").html(msg.data.savedPages.toLocaleString('en') + "/" + msg.data.allPages.toLocaleString('en') + " (" + percent + "%)");
        $("#dl-bytes").html(msg.data.savedBytes);
    }
}

function updateProjects(msg) {
    //the order of projects should not change between every request, so we need to check rows one by one. anything that does not match should be removed! and at end we should add remaining items!
    // in this situation even if first item of a list of 100 project get deleted we just delete all list once and it will not need to do this every execution of list update
    let listIndex = 0;
    let data = msg.projects;
    //we see data as a stack. if first item is in projects list then shift it from stack
    while(listIndex < $("#projects li").length) {
        if($(`#projects li:nth-child(${listIndex+1})`).data("pid") != data[0].pid) {
            $(`#projects:nth-child(${listIndex+1})`).remove();
        } else {
            //update data first
            $(`#projects li:nth-child(${listIndex+1})`).data("isActive", data[0].isActive);
            $(`#projects li:nth-child(${listIndex+1})`).data("name", data[0].name);

            data.shift();
            listIndex++;
        }
    }

    data.forEach((item, i) => {
        $("#projects").append(`<li class="w3-padding-16 w3-hover-light-grey"></li>`);
        $("#projects li:last-child").data("pid", item.pid);
        $("#projects li:last-child").data("isActive", item.isActive);
        $("#projects li:last-child").data("name", item.name);
    });


    if($("#projects li").length > 0) {
        if(activeProject == 0)
            $("#projects li:first-child").click();
        else
            highlightActiveProject();
    }
}




function highlightActiveProject() {
    $(".project-list ul li").removeClass("w3-green w3-hover-light-green");
    $(".project-list ul li").addClass("w3-hover-light-grey");


    $("#projects li").each(function(){
        //if activeProject not set then the first item will be active
        if(activeProject == 0) activeProject = $(this).data("pid");

        //set current row text
        $(this).html('<img src="/style/web-32.png" class="w3-padding-small">' + $(this).data("name") + (!$(this).data("isActive")? " (Paused)":""));

        if($(this).data("pid") == activeProject) {
            $(this).addClass("w3-green w3-hover-light-green");
            $(this).removeClass("w3-hover-light-grey");

            //change pause/resume button text
            if($(this).data().isActive) {
                $("#projectPause").text("Pause Project");
            } else {
                $("#projectPause").text("Resume Project");
            }
        }
    });
};

$("#projects").on("click", "li", function(){
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
    if((activeProject != 0) && confirm("this action could not be undone?\nAre you sure?")) {//show to user how much data was downloaded and get confirm that user has exported them
        BGConnection.postMessage({
            type:"Delete",
            pid: activeProject
        });
        activeProject = 0;
        $("#activePages").find("tr:gt(0)").remove();
    }
});

$("#addProject").click(function () {
    browser.browserAction.openPopup();
});


var wExportCanceled;
$("#projectExport").click(function(){
    wExportCanceled = false;

    $("#exportProgressBar").text("0%");
    $("#exportProgressBar").css("width", 0);

//    $("#wExport").css("display", "block");
    BGConnection.postMessage({
        type:"Export",
        pid: activeProject
    });
});

$("#wExportCancel").click(function() {
    // TODO: Cancel the job
    $("#wExport").css("display", "none");
    wExportCanceled = true;
});

function updateExportStatus(msg) {
    $("#wExport").css("display", "block");
    $("#exportMessage").text(msg.message);
    $("#exportCurrentFile").text(msg.currentFile);
    $("#exportProgressBar").text(Math.round(msg.status) + "%");
    $("#exportProgressBar").css("width", msg.status.toFixed(2)+"%");
}

function saveFile(msg) {
    $("#wExport").css("display", "none");
    if(!wExportCanceled)
        saveAs(msg.content, msg.name);
}
