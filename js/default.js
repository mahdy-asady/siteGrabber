"use strict";
//initDB(listProjects);

var activeProject; //current active dispay project

browser.runtime.onMessage.addListener(updateWindow);
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
                <td><div class="w3-light-grey"><div class="w3-container w3-red w3-center" style="width:${item.status}%">${item.status}%</div></div></td>
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
    browser.runtime.sendMessage({
        type:"toggleActivate",
        pid: activeProject
    });
});

$("#projectDelete").click(function() {
    if((activeProject != undefined) && confirm("this action could not be undone?\nAre you sure?")) {//show to user how much data was downloaded and get confirm that user has exported them
        browser.runtime.sendMessage({
            type:"Delete",
            pid: activeProject
        });
    }
});

$("#addProject").click(function () {
    browser.browserAction.openPopup();
});

$("#new-project-close").click(function() {
     $('#new-project').css("display", "none");
});
