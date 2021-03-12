#!/bin/bash

#Setting variables
VERSION=$(git describe --tags --long)

files=("manifest.json")
files+=("style/grabber-16.gif")
files+=("style/grabber-32.gif")
files+=("style/grabber.svg")
files+=("style/web-32.png")
files+=("windows/mainWindow.html")
files+=("windows/new.html")
files+=("js/ext/FileSaver.min.js")
files+=("js/ext/jquery-3.5.1.min.js")
files+=("js/ext/jszip.js")
files+=("style/w3.css")

SRCs=("js/clsProject.js")
SRCs+=("js/db.js")
SRCs+=("js/mainWindow.js")
SRCs+=("js/new.js")
SRCs+=("js/projectManager.js")
SRCs+=("js/windowManager.js")

echo "**********************************************"
echo "    Manipulating $VERSION"
echo "**********************************************"

echo
echo "Copying files..."
for t in ${files[@]}; do
	mkdir -p $(dirname tmp/$t)
	cp $t "tmp/$t"
done
#set version in manifest file
sed -i "s/%VERSION%/$VERSION/" tmp/${files[0]}

echo "Compressing files..."
for t in ${SRCs[@]}; do
	echo "    $t ..."
	mkdir -p $(dirname tmp/$t)
	google-closure-compiler --js $t --js_output_file "tmp/$t"
done

echo "Adding to archive..."
#removing previous .xpi file
rm -f release/siteGrabber-${VERSION}.xpi
cd tmp
zip -qr ../release/siteGrabber-${VERSION}.xpi *
rm -rf *
cd ..

echo
echo -e "Done!       \e[92m\"release/siteGrabber-${VERSION}.xpi\"\e[0m      Created!"
echo "**********************************************"
