## FusionAuth CLI

The FusionAuth CLI is a command line tool for interacting with FusionAuth. It is written in Typescript and is available as an NPM package.

## Requirements

* A modern version of node (tested on 19)
* A FusionAuth instance (download it here: https://fusionauth.io/download )

## Installation & usage

To install and use @fusionauth/cli, run the following commands:
```bash
npm i @fusionauth/cli;  # install
npx fusionauth --help;  # use
```

You can install it globally for ease of use from anywhere, but global npm installations can potentially lead to conflicts:
```bash
npm i -g @fusionauth/cli; # install
fusionauth --help;        # use
```

Currently, the CLI supports the following commands:
- `fusionauth theme:download` - Download a theme from a FusionAuth server.
- `fusionauth theme:upload` - Upload a theme to a FusionAuth server.
- `fusionauth theme:watch` - Watch a theme directory and upload changes to a FusionAuth server.

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
```

## License

This code is available as open source under the terms of the [Apache v2.0 License](https://opensource.org/licenses/Apache-2.0).
