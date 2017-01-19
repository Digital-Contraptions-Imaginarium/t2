// ************************************************************************* //
// This is intended to be a command-line, memoized and rate-limited Twitter  //
// API client                                                                //
// ************************************************************************* //

const
    // https://github.com/jprichardson/node-fs-extra
    // MIT license
    fs = require("fs-extra"),
    path = require("path"),
    // https://github.com/jhurliman/node-rate-limiter
    // MIT license
    Limiter = require('limiter').RateLimiter,
    // https://github.com/substack/json-stable-stringify
    // MIT license
    stringify = require('json-stable-stringify'),
    // https://github.com/desmondmorris/node-twitter
    // MIT license
    Twitter = require('twitter'),
    // https://github.com/yargs/yargs
    // MIT/X11 license
    argv = require('yargs').argv;

const
    APPLICATION_NAME = "twitter2rss";

var
    configuration = {
        // TODO: not all environment variables are relevant to memoization
        "timestamp": new Date(),
        "environment": process.env,
        "arguments": argv,
    },
    hashForMemoization = stringify(configuration);

// create the cache folder used for memoization, if it does not exist already
try {
    // TODO: this is suitable to recent Fedora distros, but what about other OS's?
    fs.ensureDirSync(path.join(process.env.HOME, ".local", APPLICATION_NAME, "cache"));
} catch (e) {
    console.error(new Error("Error creating the memoization cache folder."));
    process.exit(1);
}

twitterClient = new Twitter(t2rShared.getConfiguration().twitter);


console.log(hashForMemoization);
