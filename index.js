const path = require("path");
const fs = require("fs");
const cp = require("child_process");
// External modules
const request = require("request");
const dotenv = require("dotenv");
const ytdl = require("ytdl-core");
const ffmpeg = require("ffmpeg-static");
const TelegramBot = require("node-telegram-bot-api");
// Global constants
dotenv.config({ path: "./config.env" });

// Create the download folder
const dir = "./downloads";

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

// Bot shit
const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, {
  polling: true,
});

bot.on("message", msg => {
  const chatId = msg.chat.id;
  let url;
  const fileOptions = {
    contentType: "video/mp4",
  };

  try {
    if (msg.text !== "/start") {
      url = new URL(msg.text);
      console.log(chatId);
      if (!msg.text.startsWith("https://youtu.be")) throw new Error();

      bot.sendMessage(chatId, "Getting video info...");

      getVideoDetails(msg.text, chatId).then(data => {
        const filePath = path.join(process.cwd(), "downloads", data.filename);
        mergeVideoAndAudio(data.url, filePath, chatId)
          .then(() => {
            console.log("Uploading...");
            bot.sendMessage(chatId, "Uploading...");
            bot
              .sendVideo(
                chatId,
                filePath,
                {
                  caption: `${data.caption}\n\n ID: @uTubeVideoDownloadBot`,
                  // thumb: data.videoThumb,
                },
                fileOptions
              )
              .then(() => console.log("Uploaded"))
              .catch(err => {
                bot.sendMessage(
                  chatId,
                  "There was an error, Please try again later."
                );
                console.log(err);
              })
              .finally(() => {
                const mp4Path = filePath;
                // const thumbPath = `${filePath.slice(0, -4)}.jpg`;

                if (fs.existsSync(mp4Path)) {
                  fs.unlinkSync(mp4Path);
                }

                // if (fs.existsSync(thumbPath)) {
                //   fs.unlinkSync(thumbPath);
                // }
              });
          })
          .catch(err => {
            console.log(err);
            bot.sendMessage(
              chatId,
              "We are having a issue with uploading the video, Please try again later."
            );
          });
      });
    }
  } catch (err) {
    bot.sendMessage(chatId, "Please enter a valid youtube url");
    console.log(err);
  }
});

function getVideoDetails(url, chatId) {
  console.log("Getting video info...");
  return new Promise((resolve, reject) => {
    ytdl
      .getBasicInfo(url)
      .then(data => {
        const videoTitle = data.videoDetails.title;
        // const thumbnails = data.videoDetails.thumbnails;
        // const thumbPath = path.join(
        //   process.cwd(),
        //   "downloads",
        //   `${videoTitle}_${chatId}${thumbFormat}`
        // );
        // downloadThumbnail(
        //   thumbnails[thumbnails.length - 1].url,
        //   thumbPath,
        //   () => {
        //     console.log("Downloaded Thumbnail");
        //   }
        // );

        resolve({
          url,
          filename: `${videoTitle}_${chatId}.mp4`,
          caption: videoTitle,
          // videoThumb: thumbPath,
        });
      })
      .catch(err => reject(err));
  });
}

// function downloadThumbnail(url, path, cb) {
//   request.head(url, (err, res, body) => {
//     request(url).pipe(fs.createWriteStream(path)).on("close", cb);
//   });
// }

function mergeVideoAndAudio(url, filename, chatId) {
  return new Promise((resolve, reject) => {
    console.log("Downloading video...");
    bot.sendMessage(chatId, "Downloading video...");

    // Get audio and video streams
    const audio = ytdl(url, { quality: "highestaudio" });
    const video = ytdl(url, { quality: "highestvideo" });

    // Start the ffmpeg child process
    const ffmpegProcess = cp.spawn(
      ffmpeg,
      [
        // Remove ffmpeg's console spamming
        "-loglevel",
        "8",
        "-hide_banner",
        // Redirect/Enable progress messages
        "-progress",
        "pipe:3",
        // Set inputs
        "-i",
        "pipe:4",
        "-i",
        "pipe:5",
        // Map audio & video from streams
        "-map",
        "0:a",
        "-map",
        "1:v",
        // Keep encoding
        "-c:v",
        "copy",
        // Define output file
        filename,
      ],
      {
        windowsHide: true,
        stdio: [
          /* Standard: stdin, stdout, stderr */
          "inherit",
          "inherit",
          "inherit",
          /* Custom: pipe:3, pipe:4, pipe:5 */
          "pipe",
          "pipe",
          "pipe",
        ],
      }
    );

    // Link streams
    // FFmpeg creates the transformer streams and we just have to insert / read data
    ffmpegProcess.stdio[3]
      .on("data", chunk => {
        // Parse the param=value list returned by ffmpeg
        const lines = chunk.toString().trim().split("\n");
        const args = {};
        for (const l of lines) {
          const [key, value] = l.split("=");
          args[key.trim()] = value.trim();
        }
      })
      .on("end", () => resolve())
      .on("error", err => reject(err));
    audio.pipe(ffmpegProcess.stdio[4]);
    video.pipe(ffmpegProcess.stdio[5]);
  });
}
