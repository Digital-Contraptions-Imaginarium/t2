// ************************************************************************* //
// This is a command-line wrapper for the memoized-twitter-client.js library //
// ************************************************************************* //

const
    Twitter = require("./memoized-twitter-client").Twitter,
    // http://underscorejs.org/
    // custom license, MIT-derived?
    _ = require('underscore');

const
    APPLICATION = {
        LOCAL: "im.dico.twitter2rss",
        NAME: "twitter2rss-client",
        VERSION: "0.9.1"
    },
    COMMANDS = [ "lists" ];

var
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
        // NOTE: because of a bug in the .command directive, it is not used here, see
        // https://github.com/yargs/yargs/issues/762 ; I've stopped
        // implementing checks on the command line while waiting for a resolution to this.
        .epilog(APPLICATION.NAME + " v" + APPLICATION.VERSION + "\nThis software is copyright (C) 2017 Digital Contraptions Imaginarium Ltd. 2017 and released under the MIT Licence (MIT).")
        .argv;

var twitter = new Twitter({
    "consumerkey": argv.consumerkey,
    "consumersecret": argv.consumersecret,
    "tokenkey": argv.tokenkey,
    "tokensecret": argv.tokensecret
});

twitter.getLists((err, response) => {
    console.log(JSON.stringify(response));
});
