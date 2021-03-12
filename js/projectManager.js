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
            case "getProjectsList":
                listProjects();
                break;
            case "addProject":
                newProject(msg.data);
                break;
            case "editProject":
                editProject(msg.data);
                break;
            case "deleteProject":
                deleteProject(msg.pid);
                break;
            case "toggleActivate":
                toggleActivate(msg.pid);
                break;
            case "getProjectInfo":
                getProjectInfo(msg.pid);
                break
            case "getProjectStatus":
                sendProjectStatus(msg.pid);
                break;
            case "getProjectActiveJobs":
                getProjectActiveJobs(msg.pid);
                break;
            case "exportProject":
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
            Projects[item.pid] = new Project(item);
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
        data.pid = pid;
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
            Projects[pid] = new Project(data);
            sendMessage("siteGrabberNew", {
                type:"ok"
            });
        };
    };

}

function editProject(data) {
    data.isActive = Projects[data.pid].info.isActive;
    Projects[data.pid].setInfo(data);
    //put data
    let dbProjects = db.transaction("Projects", "readwrite").objectStore("Projects");
    dbProjects.put(Projects[data.pid].info);
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
    Projects[pid].setActive(!Projects[pid].info.isActive);

    let dbProjects = db.transaction("Projects", "readwrite").objectStore("Projects");
    dbProjects.put(Projects[pid].info);
}


function getProjectInfo(pid) {
    var request = db.transaction("Projects").objectStore("Projects").get(pid);
    request.onsuccess = function(event) {
        sendMessage("siteGrabberMain", {
            type : "ProjectInfo",
            data : request.result
        });
    }
}

function sendProjectStatus(pid) {
    let index = db.transaction("Pages").objectStore("Pages").index("pid");
    let allPages = index.count(pid);
    allPages.onsuccess = ()=>{
        var savedPages = 0, savedBytes = 0;

        var range = IDBKeyRange.bound([pid, 1],[pid, Date.now()]);
        let Pages = db.transaction("Pages").objectStore("Pages").index("pageDated");
        var rq = Pages.openCursor(range);

        rq.onsuccess = ()=>{
            let cursor = rq.result;
            if(cursor != null) {
                savedPages++;
                savedBytes += cursor.value.content.size;
                cursor.continue();
            }
            else {
                let data = {
                    allPages    : allPages.result,
                    savedPages  : savedPages,
                    savedBytes  : formatBytes(savedBytes)
                }
                sendMessage("siteGrabberMain", {
                    type  : "projectStatus",
                    pid   : pid,
                    data  : data
                });
            }
        }
    }
}

function getProjectActiveJobs(pid) {
    if(Projects[pid]) Projects[pid].sendActiveJobs();
}

function listProjects() {
    let rpt = [];
    Object.keys(Projects).forEach(item => {
        rpt.push({
            pid: Projects[item].info.pid,
            isActive: Projects[item].info.isActive,
            name: Projects[item].info.name
        });
    });

    sendMessage("siteGrabberMain", {
        type:"projectsList",
        projects: rpt
    });
}


function exportProject(pid){
    var request = db.transaction("Projects").objectStore("Projects").get(pid);

    request.onsuccess = function(event) {
        // Do something with the request.result!
        let pName = request.result.name;

        let index = db.transaction("Pages").objectStore("Pages").index("pid");
        //create jsZip
        let zip = new JSZip();
        //create a root folder based on project name and store all files in it
        let root = zip.folder(pName);
        var data = index.getAll(IDBKeyRange.only(pid));
        data.onsuccess = async function(event) {
            var allPages = {}
            data.result.forEach(page=>{
                if(page.time && (page.content.size>0)) {//just save files that has been scanned at last 1.
                    allPages[page.path] = page;
                }
            });
            let pageCount = Object.keys(allPages).length;
            var i=0;
            for(p in allPages) {
                sendMessage("siteGrabberMain", {
                    type:           "exportStatus",
                    message:        "Manipulating web pages...",
                    status:         (++i/pageCount)*100/2,
                    currentFile:    p
                });

                page = allPages[p];
                let header = (typeof page.header === 'undefined')? "" : page.header;
                if(i == 1) {//first link. we should create a root index that links to it
                    root.file("index.htm", createIndexPage(page.filePath));
                }
                var content = page.content;

                if(header.left(9) == "text/html") {
                    //ok now replace links...
                    content = await content.text();
                    content = replaceLinks(content, (tag, g1, href) =>{
                        try {
                            url = new URL(href, page.path);
                        } catch (e) {
                            return tag;
                        }

                        let hash = url.hash;
                        url.hash = "";  //remove hash part of url
                        let txtUrl = url.href;
                        //ok we have link address. first wa have to ensure that we already downloaded this link.
                        //if so then just get header content and get file address of it
                        //if not, then just return link address
                        if(allPages[txtUrl] && allPages[txtUrl].time > 0) {
                            txtUrl = allPages[txtUrl].filePath;
                            txtUrl = getRelativePath(txtUrl, page.filePath);
                        }
                        //Add hash if there is
                        txtUrl = txtUrl + hash;
                        return tag.replace(href, txtUrl);
                    });
                }
                //adding files to zip
                root.file(page.filePath, content, {createFolders:true});
            }
            //saving file
            zip.generateAsync({
                type:                   "blob",
                compression:            "DEFLATE",  //STORE, DEFLATE
                compressionOptions:     {level: 1}, //1:best speed 9:best compression
                comment:                "Generated by siteGrabber"
            }, data=>{
                sendMessage("siteGrabberMain", {
                    type:           "exportStatus",
                    message:        "Adding files to archive...",
                    status:         50+data.percent/2,
                    currentFile:    data.currentFile
                });
            }).then(function(content) {
                sendMessage("siteGrabberMain", {
                    type:"exportFile",
                    name: pName + ".zip",
                    content: content
                });
            });
        }
    }
}

function getFileName(url, contentType) {
    if(typeof contentType === 'undefined') contentType = "";
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
        ":"  : "_3A",
        "<"  : "_3C",
        ">"  : "_3E",
        "\"" : "_22",
        "\\" : "_5C",
        "|"  : "_7C",
        "?"  : "_3F",
        "*"  : "_2A"
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
    if(baseChunks.length>0)
        newPath = "../".repeat(baseChunks.length-1);
    newPath += pathChunks.join("/");
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

function createIndexPage(path) {
    return `<html>
<head>
<title>Powered by siteGrabber</title>
</head>
<body>
<h1><a href="${path}">Start here</a></h1>
</body></html>`;
}



function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
