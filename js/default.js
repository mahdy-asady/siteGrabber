"use strict";
initDB(listProjects);

var activeProject; //current active dispay project



/*
(function (){
    var request = window.indexedDB.open("__DATA__", 1);
    request.onerror = function(event) {
      console.log("Why didn't you allow my web app to use IndexedDB?!");
      console.error("Database error: " + event.target.errorCode);
    };

    request.onsuccess = function(event) {
      db = event.target.result;
      listProjects();
    };
})();
*/

function listProjects() {
    var objectStore = db.transaction("Projects").objectStore("Projects");

    objectStore.getAll().onsuccess = function(event) {
        $("#projects").empty();
        event.target.result.forEach(Project => $("#projects").append("<li data-name=\"" + Project.name + "\" data-active=" + Project.active + " class=\"w3-padding-16 w3-hover-light-grey\"><img src=\"/style/web-32.png\" class=\"w3-padding-small\">" + Project.name + "</li>"));
        if(!listProjects.hasExecuted) {
            $(".project-list ul li:first-child").click();
            listProjects.hasExecuted = 1;
        }
        else {
            highlightActiveProject();
        }
    };
}






function highlightActiveProject() {
    $(".project-list ul li").removeClass("w3-green w3-hover-light-green");
    $(".project-list ul li").addClass("w3-hover-light-grey");

    $(".project-list ul li").each(function(){
        if($(this).data().name == activeProject) {
            $(this).addClass("w3-green w3-hover-light-green");
            $(this).removeClass("w3-hover-light-grey");
        }
    });
};



var num = 0;
function updateWindow() {
    num++;
    $("#dl-bytes").text(num);
    $("#active-time").text(activeProject);
};

window.setInterval(updateWindow, 300);
window.setInterval(listProjects, 3000);






$(".project-list ul").on("click", "li", function(){
    activeProject = $(this).data().name;
    highlightActiveProject();
    //call ...

});



$("#addProject").click(function () {
    browser.browserAction.openPopup();
    //window.open("new.html");
    //$('#new-project').css("display", "block");

    var data = { name: "www.jj.com", active: true, config: ""};

    var transaction = db.transaction("Projects", "readwrite");

    var objectStore = transaction.objectStore("Projects");
    var request = objectStore.add(data);
    request.onsuccess = function(event) {
        console.log("Project added successfully!");
    };


    /*var data2 = [
        { name: "www.yahoo.com", active: true, config: ""},
        { name: "www.gmail.com", active: false, config: ""},
        { name: "www.microsoft.com", active: true, config: ""},
        { name: "www.apple.com", active: false, config: ""}
    ];
    data2.forEach(function(dt) {
        objectStore.add(dt);
    });*/
});
$("#new-project-close").click(function() {
     $('#new-project').css("display", "none");
});
