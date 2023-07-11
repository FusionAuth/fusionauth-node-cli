## FusionAuth CLI

The FusionAuth CLI is a command line tool for interacting with FusionAuth. It is written in Typescript and is available as an NPM package.

## Requirements

* A modern version of node (tested on 19)
* A FusionAuth instance (download it here: https://fusionauth.io/download)

## Installation

To install @fusionauth/cli, run the following command:

```bash
npm i -g @fusionauth/cli
```

## Usage

```bash
fusionauth --help
```

Currently, the CLI supports the following commands:
- `fusionauth email:create` - Create a new email template locally.
- `fusionauth email:download` - Download a specific template or all email templates from a FusionAuth server.
- `fusionauth email:duplicate` - Duplicate an email template locally.
- `fusionauth email:html-to-text` - Convert HTML email templates to text, where the text template is missing.
- `fusionauth email:upload` - Upload a specific template or all email templates to a FusionAuth server.
- `fusionauth email:watch` - Watch the email template directory and upload changes to a FusionAuth server.
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

## License

This code is available as open source under the terms of the [Apache v2.0 License](https://opensource.org/licenses/Apache-2.0).
