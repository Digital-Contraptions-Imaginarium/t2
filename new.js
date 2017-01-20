// ************************************************************************* //
// This is intended to be a command-line, memoized and rate-limited Twitter  //
// API client                                                                //
// ************************************************************************* //

const
    APPLICATION = {
        NAME: "twitter2rss",
        VERSION: "0.9.1"
    },
    COMMANDS = [ "lists" ],
    DEFAULT_OPTIONS = {
        "consumerkey": { "default": process.env.TWITTER2RSS_CONSUMER_KEY },
        "consumersecret": { "default": process.env.TWITTER2RSS_CONSUMER_SECRET },
        "tokenkey": { "default": process.env.TWITTER2RSS_ACCESS_TOKEN_KEY },
        "tokensecret": { "default": process.env.TWITTER2RSS_ACCESS_TOKEN_SECRET }
    };

var
    crypto = require('crypto'),
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
    argv = require('yargs')
        .usage('Usage: $0 <command> [options]')
        .default({
            "consumerkey": process.env.TWITTER2RSS_CONSUMER_KEY,
            "consumersecret": process.env.TWITTER2RSS_CONSUMER_SECRET,
            "tokenkey": process.env.TWITTER2RSS_ACCESS_TOKEN_KEY,
            "tokensecret": process.env.TWITTER2RSS_ACCESS_TOKEN_SECRET
        })
        .demandCommand(1, "You must specify a <command>, that is one of: " + COMMANDS.sort().join(", "))
        .check((argv, opts) => {
            // console.log("argv: " + JSON.stringify(argv));
            // console.log("opts: " + JSON.stringify(opts));
            // check the command is one of the possible ones
            if (!_.contains(COMMANDS, argv._[0])) { throw(new Error("<command> must be one of: " + COMMANDS.sort().join(", "))); return false; }
            return true;
        })
        .check((argv, opts) => {
            // check that all the twitter credentials are specified
            if(_.any([
                argv.consumerkey,
                argv.consumersecret,
                argv.tokenkey,
                argv.tokensecret
            ], x => (!_.isString(x) || (x === "")))) { throw(new Error("The Twitter credentials are not specified either in the environment or the command line.")); return false; }
            return true;
        })
        // NOTE: because of a bug in the .command directive, it is not used here, see
        // https://github.com/yargs/yargs/issues/762 ; I've stopped
        // implementing checks on the command line while waiting for a resolution to this.
        .epilog(APPLICATION.NAME + " v" + APPLICATION.VERSION + "\nThis software is copyright (C) 2017 Digital Contraptions Imaginarium Ltd. 2017 and released under the MIT Licence (MIT).")
        .argv;

var
    configuration = {
        // TODO: not all environment variables are relevant to memoization
        "application": APPLICATION,
        "command": argv._[0],
        "timestamp": new Date(),
        "arguments": argv,
    },
    hashForMemoization = crypto.createHash('sha1');

// calculate the hash for memoization from some parts of the configuration
hashForMemoization =
    configuration.command +
    "_" +
    hashForMemoization.update(stringify(_.pick(configuration,
        "application", // so that different versions make different hashes
        "command",
        "environment",
        "arguments"
    ))).digest('hex') +
    "_" +
    configuration.timestamp.toISOString().
        replace(/\..+$/, ''). // delete the dot and everything after
        replace(/[T\-:]/g, ''). // delete the 'T', hyphens and columns
        replace(/^.../, ''); // drops the first three characters of the year, not useful

console.log(hashForMemoization);
process.exit(0);

// create the cache folder used for memoization, if it does not exist already
try {
    // TODO: this is suitable to recent Fedora distros, but what about other OS's?
    fs.ensureDirSync(path.join(process.env.HOME, ".local", APPLICATION.NAME, "cache"));
} catch (e) {
    console.error(new Error("Error creating the memoization cache folder."));
    process.exit(1);
}

// TODO: some garbage collection

var twitterClient = new Twitter({
    "consumer_key": argv.consumerkey,
    "consumer_secret": argv.consumersecret,
    "access_token_key": argv.tokenkey,
    "access_token_secret": argv.tokensecret
});

console.log(JSON.stringify(configuration));
process.exit(0);

twitterClient.get(
    "lists/list.json",
    { }, // any params?
    function (err, lists, response) {
        if (err) {
            console.error("Failed querying Twitter API for metadata about all lists, with error message: " + err.message);
            return process.exit(1);
        }
        console.log(JSON.stringify(lists));
    }
);
