const fs = require("fs");
const request = require("request");

function getThumbnail(url, path) {
  request.head(url, () => {
    request(url).pipe(fs.createWriteStream(path));
  });
}

module.exports = getThumbnail;
