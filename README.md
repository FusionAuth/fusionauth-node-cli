## FusionAuth CLI

The FusionAuth CLI is a command line tool for interacting with FusionAuth. It is written in Typescript and is available as an NPM package.

## Requirements

* A modern version of node (tested on 19)
* A FusionAuth instance (download it here: https://fusionauth.io/download)

## Installation & usage

To install and use @fusionauth/cli, run the following commands:
```bash
npm i @fusionauth/cli;
npx fusionauth --help;
```

You can install it globally for ease of use from anywhere, but global installations can potentially lead to conflicts and are not recommended:
```bash
npm i -g @fusionauth/cli;
fusionauth --help;
```

Currently, the CLI supports the following commands:
- Emails
  - `fusionauth email:download` - Download a specific template or all email templates from a FusionAuth server.
  - `fusionauth email:duplicate` - Duplicate an email template locally.
  - `fusionauth email:html-to-text` - Convert HTML email templates to text, where the text template is missing.
  - `fusionauth email:upload` - Upload a specific template or all email templates to a FusionAuth server.
  - `fusionauth email:watch` - Watch the email template directory and upload changes to a FusionAuth server.
  - `fusionauth email:create` - Create a new email template locally.
- Lambdas
  - `fusionauth lambda:create` - Upload a lambda to a FusionAuth server.
  - `fusionauth lambda:delete` - Delete a lambda from a FusionAuth server.
  - `fusionauth lambda:retrieve` - Download a lambda from a FusionAuth server.
- Themes
  - `fusionauth theme:download` - Download a theme from a FusionAuth server.
  - `fusionauth theme:upload` - Upload a theme to a FusionAuth server.
  - `fusionauth theme:watch` - Watch a theme directory and upload changes to a FusionAuth server.

Instead of supplying the API key with the `-k` option on every command, you can set the `FUSIONAUTH_API_KEY` environment variable.
The same goes for the host URL option `-h`, which can be set with the `FUSIONAUTH_HOST` environment variable.

## Questions and support

If you have a question or support issue regarding this client library, we'd love to hear from you.

If you have a paid edition with support included, please [open a ticket in your account portal](https://account.fusionauth.io/account/support/). Learn more about [paid editions here](https://fusionauth.io/pricing).

Otherwise, please [post your question in the community forum](https://fusionauth.io/community/forum/).

## Releasing

To bump the version and create a git commit and tag, run:

`npm version <major|minor|patch>`

To build and publish the package to the npm registry, run:

`npm publish`

## Contributing

Bug reports and pull requests are welcome on GitHub.

To build this library locally:
```bash
git clone https://github.com/FusionAuth/fusionauth-node-cli &&
cd fusionauth-node-cli;
npm install &&
npm run build;

# now you can use it
npx fusionauth --version;

# to get help on a command
npm run build; npx fusionauth lambda:link-to-application --help
```

To see examples of use look at https://fusionauth.io/docs/v1/tech/lambdas/testing.

## License

This code is available as open source under the terms of the [Apache v2.0 License](https://opensource.org/licenses/Apache-2.0).
