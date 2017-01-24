twitter2rss
===========

Note: this GitHub branch is dedicated to *t2*: a major overhaul of the original *twitter2rss* project that - over time - has grown into something that was too complex for my liking and contrary to my principles for simple and frugal solutions. In this README you find the new documentation only, the old is available at the [*master*](https://github.com/Digital-Contraptions-Imaginarium/twitter2rss) branch.

t2
==

*t2* is a Node.js module and command line client for Twitter. It owes its name to [sferik/t](https://github.com/sferik/t): another command line client for Twitter that I aim at replacing in my projects at some point. Differently than other Twitter libraries for Node.js, *t2* was written to be smart about rate limiting and data use in general, support for which are built in.

At the moment of writing, *t2* only supports APIs that "read" content (the "GET" ones).

## t2cli

*t2cli* is *t2*'s command line tool. In order to keep it as simple as possible, it mimics the syntax of the APIs it wraps up, rather than having its own commands and options. The general usage in fact is:

```
$ node t2cli.js <twitter_api_name> [twitter_option] [twitter_option] ... [t2_option] [t2_option] ...
```

where:
- ```twitter_api_name``` is the Twitter API name as you see them listed at [https://dev.twitter.com/rest/public/rate-limits](https://dev.twitter.com/rest/public/rate-limits), e.g. ```lists/list```;
- ```twitter_option``` is one of the options the specified API supports, e.g. ```--user_id giacecco```, and
- ```t2_option``` is one of the *t2* specific options, e.g. ```consumerkey```, ```consumerkey```, ```consumersecret``` and ```tokenkey``` for the credentials to use to connect to the Twitter servers.

When not specified on the command line, both *t2cli* and the *t2* library attempt reading the credentials from the user environment in the variables ```TWITTER2RSS_CONSUMER_KEY```, ```TWITTER2RSS_CONSUMER_SECRET```, ```TWITTER2RSS_ACCESS_TOKEN_KEY``` and ```TWITTER2RSS_ACCESS_TOKEN_SECRET```.

The ```--post``` *t2* option can be used to run one or more transformations over the API results, before displaying, expressed as a JavaScript function. E.g. a very useful transformation is ```--post 'r => r.map(x => JSON.stringify(x)).join("\n")' ``` that makes one JSON array of objects - as in the results of the original ```lists/list``` API - into [JSONL](http://jsonlines.org/): one JSON object per line.

In the example below, for example, we fetch the lists that belong to user [@dicoim](https://twitter.com/dicoim), pick the third list only, and transform the output from JSON to JSONL.

```
$ node t2cli.js lists/list --user_id dicoim --post 'r => [ r[2] ]' --post 'r => r.map(x => JSON.stringify(x)).join("\n")'
```
