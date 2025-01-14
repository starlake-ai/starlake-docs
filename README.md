# Install Node
See https://itsromiljain.medium.com/the-best-way-to-install-node-js-npm-and-yarn-on-mac-osx-4d8a8544987a


# Website

This website is built using [Docusaurus 2](https://docusaurus.io/), a modern static website generator.

## Installation

```console
yarn install
```

## Local Development

```console
BASE_URL=/starlake/ yarn start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```console
BASE_URL=/starlake/ yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

We're using cloudflare pages to deploy the docs.
The deployment is done automatically when a PR is merged to the main branch.
When the PR is merged, the cloudflare pages will automatically build and deploy the changes two cloudflare pages:
 - docs: https://docs.starlake.ai using https://dash.cloudflare.com/ec8885017c1f05235b32673b17651361/pages/view/docs-starlake
 - blog: https://blog.starlake.ai using https://dash.cloudflare.com/ec8885017c1f05235b32673b17651361/pages/view/blog-starlake
