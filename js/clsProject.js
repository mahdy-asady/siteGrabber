"use strict";

class Project {
    /*
        jobs array
        [
            {
                pageID: number,
                path:string
                progress: 0-100 <0: not started, 40: content downloaded, 50: content saved, 50-100: saving links>
            }
        ]
    */
    //jobs = [];
    constructor(inf) {
        this.jobs=[];
        this.configuration = inf;

        this.startSeederIfProjectIsActive();
    }

    //*************************************************************************

    // TODO: Setter and getter of configuration property

    get pid() {
        return this.configuration.pid;
    }

    //*************************************************************************

    set isActive(status) {
        //convert to boolean with !!
        this.configuration.isActive = !!status;
        this.startSeederIfProjectIsActive();
    }

    get isActive() {
        return this.configuration.isActive;
    }

    toggleActive() {
        this.isActive = !this.isActive;
    }

    //*************************************************************************

    set name(name) {
        this.configuration.name = name;
    }

    get name() {
        return this.configuration.name;
    }

    //*************************************************************************

    setConfig(info) {
        this.configuration = info;
    }

    getConfig() {
        return this.configuration;
    }
    //*************************************************************************

    sendActiveJobs() {
        sendMessage("siteGrabberMain", "projectActiveJobs", {
            time : Date.now(),
            pid  : this.pid,
            jobs : this.jobs
        });
    }

    //*************************************************************************

    destructor() {
        this.configuration = null;
    }

    //*************************************************************************

    /*
        1. get link Content
        2. save content to db
        3. if it is a html file, extract links
        4. save links
    */
    worker(job) {
        return new Promise((resolve, reject) => {
            job.progress = 10;
            fetch(job.path).then(response => {
                job.progress = 40;
                if(response.ok) {
                    response.blob().then(content => {
                        let contentType = response.headers.get('Content-Type');
                        //ok we have data. first write it to db
                        if(response.redirected) { //we have a redirected page
                            //so we have to save main link as a redirect page and save content as separate page
                            //here we just created a virtual page that have the redirected url inside itself
                            content = getRedirectPage(response.url);
                            contentType = "text/html; charset=utf-8";
                        }
                        this.savePage(job.pageID, content, contentType);

                        // if it is text/html then extract links
                        if(contentTypeIsHTML(contentType)) {
                            job.progress = 50;
                            //now extract all available links
                            content.text().then(txt=>{
                                const matches = getLinks(txt);
                                var step = 50/matches.length;
                                let progress = 50;
                                matches.forEach((match) => {
                                    progress += step;
                                    job.progress = Math.round(progress);
                                    this.saveLink(match, job.path, job.pageID);
                                });
                            });
                        }
                        resolve();
                    });
                } else {
                    this.savePage(job.pageID, new Blob([""]), "");
                    reject();
                }
            });
        });
    }

    //*************************************************************************

    addJob(pageID, path){
        this.jobs.push({
            pageID : pageID,
            path: path,
            progress : 0
        });

        this.worker(this.jobs[this.findJobIndexByPageID(pageID)])
            .finally(()=>{this.deleteJob(pageID)});
    }

    //*************************************************************************

    async deleteJob(pageID){
        await new Promise(r => setTimeout(r, 200)); // some time for user to see progress

        this.jobs.splice(this.findJobIndexByPageID(pageID), 1);
    }

    //*************************************************************************

    findJobIndexByPageID(pageID) {
        for(let i = 0; i < this.jobs.length; i++) {
            if(this.jobs[i].pageID == pageID) {
                return i;
            }
        }
        return -1;
    }

    //*************************************************************************

    startSeederIfProjectIsActive() {
        if(this.isActive) this.seeder();
    }

    //*************************************************************************

    async seeder() {
        while(this.configuration && this.isActive) {
            if(this.jobs.length < this.configuration.config.downloadLimit) {
                await this.fetchCandidatePages();
            } else {
                await new Promise(r => setTimeout(r, 0));
            }
        }
    }

    //*************************************************************************

    fetchCandidatePages() {
        return new Promise((resolve, reject) => {
            //get pages where are for this project and are older than the age specified for update(lifetime)
            let lifeTime = Date.now() - this.configuration.config.lifeTime *24*60*60*1000;
            var range = IDBKeyRange.bound([this.pid, 0],[this.pid, lifeTime]);

            readablePagesObjectStore()
                .index("pageDated")
                    .openCursor(range)
                        .onsuccess = this.launchCandidateJobs(resolve);
        });
    }

    //*************************************************************************

    launchCandidateJobs(resolve) {
        return (event) => {
            let cursor = event.target.result;
            if(cursor) {
                let node = cursor.value;
                //first search in jobs if already fetching the url we will ignore this one
                if(this.jobs.some((job)=>{return job.pageID == node.id;})) {
                    cursor.continue();
                    return;
                }
                animateIcon();
                this.addJob(node.id, node.path);

                //ok let do some speedy. if we have some space in jobs, use current db connection and fill them...
                if(this.jobs.length < this.configuration.config.downloadLimit) {
                    cursor.continue();
                    return;
                }
            }
            resolve();
        }
    }

    //*************************************************************************

    saveLink(currentURL, baseURL, pageID) {
        try {
            let url = new URL(currentURL, baseURL);
            url.hash = "";  //remove hash part of url
            let txtUrl = url.href
            if(this.configuration.config.whiteList.indexOf(url.host) >= 0) {
                let newUrl = {
                    pid: this.pid,
                    time: 0,
                    path: txtUrl,
                    referrer: pageID
                };
                db.transaction(["Pages"], "readwrite").objectStore("Pages").add(newUrl);
            }
        } catch (e) {}
    }

    //*************************************************************************

    savePage(pageID, content, contentType) {
        var request = readablePagesObjectStore().get(pageID);
        request.onsuccess = event=>{
            let data      = event.target.result;
            data.time     = Date.now();
            data.header   = contentType;
            data.content  = content;
            data.filePath = getFileName(data.path, contentType);

            savePageToDB(data);
        };
    }
}

//*************************************************************************

function getRedirectPage(url) {
    return new Blob([`
<html>
<body>
    <h1 id="hide">Click <a id="link" href="${url}">Here</a></h1><h1 id="show" style="display:none;">Wait a second ...</h1>
</body>
<script type="text/javascript">
    (()=>{
        setTimeout(()=>{document.getElementById("link").click();}, 1000);
        document.getElementById("hide").style.display = "none";
        document.getElementById("show").style.display = "initial";
    })();
</script>
</html>`]);
}

//*************************************************************************

function contentTypeIsHTML(contentType) {
    return contentType.substr(0, 9) == "text/html";
}

//*************************************************************************
/****** Regular Expression functions ******/

let regexps = [
    /<a(?:[^>]*?)?href=(["'])(.*?)\1/gi,        //gets <a href links
    /<link(?:[^>]*?)?href=(["'])(.*?)\1/gi,     //gets <link href links
    /<img(?:[^>]*?)?src=(["'])(.*?)\1/gi,       //gets <img src links
    /<script(?:[^>]*?)?src=(["'])(.*?)\1/gi     //gets <script src links
];

function getLinks(content) {
    var result = [];
    regexps.forEach((regexp) => {
        let matches = content.matchAll(regexp);
        for (const match of matches) {
            result.push(match[2]);
        }
    });
    return result;
}

function replaceLinks(content, replacer=()=>{}) {
    regexps.forEach((regexp) => {
        content = content.replace(regexp, replacer);
    });
    return content;
}
