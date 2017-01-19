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
    // http://underscorejs.org/
    // custom license, MIT-derived?
    _ = require('underscore'),
    // https://github.com/yargs/yargs
    // MIT/X11 license
    argv = require('yargs').argv;

const
    APPLICATION_NAME = "twitter2rss";

var
    configuration = {
        // TODO: not all environment variables are relevant to memoization
        "timestamp": new Date(),
        "environment": _.pick(process.env,
            "TWITTER2RSS_CONSUMER_KEY",
            "TWITTER2RSS_CONSUMER_SECRET",
            "TWITTER2RSS_ACCESS_TOKEN_KEY",
            "TWITTER2RSS_ACCESS_TOKEN_SECRET"
        ),
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

var twitterClient = new Twitter({
    "consumer_key": configuration.environment.TWITTER2RSS_CONSUMER_KEY,
    "consumer_secret": configuration.environment.TWITTER2RSS_CONSUMER_SECRET,
    "access_token_key": configuration.environment.TWITTER2RSS_ACCESS_TOKEN_KEY,
    "access_token_secret": configuration.environment.TWITTER2RSS_ACCESS_TOKEN_SECRET
});

twitterClient.get(
    "lists/list.json",
    { }, // any params?
    function (err, lists, response) {
        if (err) {
            console.error("Failed querying Twitter API for metadata about all lists, with error message: " + err.message);
            return system.exit(1);
        }
        console.log(JSON.stringify(lists));
    }
);
