//after connecting to database. every 3 seconds we will refresh projects
initDB(initProjects);

//the key of Projects array is pid of the projects, then we could easyly access every project in this list by accessing Projects[pid]
var Projects = {}

//*************************************************************************

browser.runtime.onConnect.addListener(initConnection);
var CSConnections = {};

function initConnection(newConnection) {
    let name = newConnection.name
    CSConnections[name] = newConnection;

    CSConnections[name].onDisconnect.addListener((p) => {delete CSConnections[p.name]});

    CSConnections[name].onMessage.addListener(msg => {
        switch (msg.type) {
            case "list":
                listProjects();
                break;
            case "new":
                newProject(msg.data);
                break;
            case "Delete":
                deleteProject(msg.pid);
                break;
            case "toggleActivate":
                toggleActivate(msg.pid);
                break;
            case "Export":
                exportProject(msg.pid);
                break;
            default:

        }
    });
}

async function sendMessage(name, msg) {
    if(CSConnections[name])
        CSConnections[name].postMessage(msg);
}

//*************************************************************************

function initProjects() {
    let dbProjects = db.transaction("Projects").objectStore("Projects");
    dbProjects.getAll().onsuccess = function(event) {
        event.target.result.forEach(item => {
            //create project
            Projects[item.pid] = new Project(item.pid, item.name, item.isActive, item.config);
        });
    }
}


function newProject(data) {
    let firstLink = data.firstLink;
    delete data.firstLink;

    var transaction = db.transaction("Projects", "readwrite");
    var objectStore = transaction.objectStore("Projects");
    var request = objectStore.add(data);
    request.onsuccess = function(event) {
        let pid = event.target.result;
        //event.target.result
        let Page ={
            pid: pid,
            time: 0,
            path: firstLink
        };

        var pgTransaction = db.transaction("Pages", "readwrite");
        var Pages = pgTransaction.objectStore("Pages");
        var PagesRequest = Pages.add(Page);
        PagesRequest.onsuccess = function(event) {
            Projects[pid] = new Project(pid, data.name, data.isActive, data.config);
            sendMessage("siteGrabberNew", {
                type:"ok"
            });
        };
    };

}

function deleteProject(pid) {
    //stop project
    Projects[pid].destructor();
    //Projects[pid] = null;
    delete Projects[pid];
    //remove from db
    db.transaction("Projects", "readwrite").objectStore("Projects").delete(pid).onsuccess = (event) => {
        let index = db.transaction("Pages", "readwrite").objectStore("Pages").index("pid");
        let request = index.openCursor(IDBKeyRange.only(pid));
        request.onsuccess = function(event) {
            let cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        }
    }
}
//we certainly need a cleanup function to run every startup to remove remaining rows in Pages store.
//function cleanup(){}

function toggleActivate(pid) {
    Projects[pid].setActive(!Projects[pid].isActive);

    let dbProjects = db.transaction("Projects", "readwrite").objectStore("Projects");
    dbProjects.put({
        pid:    pid,
        isActive: Projects[pid].isActive,
        name:   Projects[pid].name,
        config: Projects[pid].config,

    });
}


function listProjects() {
    let rpt = [];
    Object.keys(Projects).forEach(item => {
        rpt.push({
            pid: Projects[item].pid,
            isActive: Projects[item].isActive,
            name: Projects[item].name
        });
    });

    sendMessage("siteGrabberMain", {
        type:"Projects",
        projects: rpt
    });
}


function exportProject(activeProject){
    var request = db.transaction("Projects").objectStore("Projects").get(activeProject);

    request.onsuccess = function(event) {
        // Do something with the request.result!
        let pName = request.result.name;

        let index = db.transaction("Pages").objectStore("Pages").index("pid");
        //create jsZip
        let zip = new JSZip();
        //create a root folder based on project name and store all files in it
        let root = zip.folder(pName);
        var data = index.getAll(IDBKeyRange.only(activeProject));
        data.onsuccess = async function(event) {
            var allPages = {}
            var count = 0;
            data.result.forEach(page=>{
                allPages[page.path] = page;
                count++;
            });

            var i=0;
            for(p in allPages) {

                sendMessage("siteGrabberMain", {
                    type:           "ExportStatus",
                    message:        "Manipulating web pages...",
                    status:         (++i/count)*100/2,
                    currentFile:    p
                });

                page = allPages[p];
                if(page.time) {//just save files that has been scanned at last 1.

                    let header = (typeof page.header === 'undefined')? "" : page.header;
                    let path = getFileName(page.path, header);
                    var content = page.content;

                    if(header.left(9) == "text/html") {
                        //ok now replace links...
                        content = await content.text();
                        content = replaceLinks(content, (tag, url) =>{
                            let result = tag.left(tag.length - url.length);
                            try {
                                url = new URL(url, page.path);
                                let txtUrl = url.protocol + "//" + url.host + url.pathname;
                                //ok we have link address. first wa have to ensure that we already downloaded this link.
                                //if so then just get header content and get file address of it
                                //if not, then just return link address
                                if(allPages[txtUrl] && allPages[txtUrl].time > 0) {
                                    txtUrl = getFileName(txtUrl, allPages[txtUrl].header)
                                    txtUrl = getRelativePath(txtUrl, path);
                                }

                                result = result + txtUrl;
                                //Add hash and query if there is

                                //console.log(result);
                                return result;
                            } catch (e) {
                                return tag;
                            }
                        });
                    }
                    //adding files to zip
                    root.file(path, content, {createFolders:true});
                }
            }
            //saving file
            zip.generateAsync({
                type:                   "blob",
                compression:            "DEFLATE",  //STORE, DEFLATE
                compressionOptions:     {level: 1}, //1:best speed 9:best compression
                comment:                "Generated by siteGrabber"
            }, data=>{
                sendMessage("siteGrabberMain", {
                    type:           "ExportStatus",
                    message:        "Adding files to archive...",
                    status:         50+data.percent/2,
                    currentFile:    data.currentFile
                });
            }).then(function(content) {
                sendMessage("siteGrabberMain", {
                    type:"Export",
                    name: pName + ".zip",
                    content: content
                });
            });
        }
    }
}

function getFileName(url, contentType) {
    //first remove protocol
    let path = url.slice(url.indexOf("://") + 3);

    //if last character of url is / then we should add index.html as file name to it
    if(path.right(1) == "/")
        path = path + "index"; //we will add extension in next level

    //if it is a html file then add proper extension
    if(contentType.left(9) == "text/html") {
        if(url.right(4) != ".htm" && url.right(5) != ".html") {
            //add .htm extensoin
            path = path + ".htm";
        }
    }

    // Now remove prohbited characters
    encodes = {
        ":"  : "%3A",
        "<"  : "%3C",
        ">"  : "%3E",
        "\"" : "%22",
        "\\" : "%5C",
        "|"  : "%7C",
        "?"  : "%3F",
        "*"  : "%2A"
    };
    path = path.replaceAll(encodes);

    return path;
}


//   www.google.com path base on index.html
//   www.google.com path rela path host p.html


//get relative path of two physical file
function getRelativePath(path, base) {
    let pathChunks = path.split("/");
    let baseChunks = base.split("/");
    let newPath = "";
    //remove equal parts of path
    while(pathChunks[0] == baseChunks[0] && pathChunks.length > 0) {
        pathChunks.shift();
        baseChunks.shift();
    }
    newPath = "../".repeat(baseChunks.length-1);
    newPath += pathChunks.join("/");
    console.log(newPath);
    return newPath;
}

String.prototype.right = function (chars) {
    return this.substring(this.length - chars);
}

String.prototype.left = function (chars) {
    return this.substring(0, chars);
}

String.prototype.replaceAll = function (characterArray) {
    let str = this;
    for (var ch in characterArray) {
        str = str.replace(ch, characterArray[ch]);
    }

    return str;
}
