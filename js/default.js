var db_projects; //Projects DB connection
var activeProject; //current active dispay project




(function (){
    var request = window.indexedDB.open("__DATA__", 1);
    request.onerror = function(event) {
      console.log("Why didn't you allow my web app to use IndexedDB?!");
      console.error("Database error: " + event.target.errorCode);
    };

    request.onsuccess = function(event) {
      db_projects = event.target.result;
      listProjects();
    };
})();

function listProjects() {
    var objectStore = db_projects.transaction("Projects").objectStore("Projects");

    objectStore.getAll().onsuccess = function(event) {
        $("#projects").empty();
        event.target.result.forEach(Project => $("#projects").append("<li data-site=\"" + Project.site + "\" data-active=" + Project.active + " class=\"w3-padding-16 w3-hover-light-grey\"><img src=\"/style/web-32.png\" class=\"w3-padding-small\">" + Project.site + "</li>"));
        if(!listProjects.hasExecuted) {
            console.log("first time run");
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
        if($(this).data().site == activeProject) {
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






$(".project-list ul").on("click", "li", function(){
    activeProject = $(this).data().site;
    highlightActiveProject();
    //call ...

});



$("#addProject").click(function () {
    var data = { site: "www.ii.com", active: true, config: ""};

    var transaction = db_projects.transaction("Projects", "readwrite");

    var objectStore = transaction.objectStore("Projects");
    var request = objectStore.add(data);
    request.onsuccess = function(event) {
        console.log("Project added successfully!");
        listProjects();
    };


    /*var data2 = [
        { site: "www.yahoo.com", active: true, config: ""},
        { site: "www.gmail.com", active: false, config: ""},
        { site: "www.microsoft.com", active: true, config: ""},
        { site: "www.apple.com", active: false, config: ""}
    ];
    data2.forEach(function(dt) {
        objectStore.add(dt);
    });*/
});
