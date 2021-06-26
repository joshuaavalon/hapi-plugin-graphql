# hapi-plugin-graphql

[![license][license_badge]][license][![npm][npm_badge]][npm] [![semantic-release][semantic_release_badge]][semantic_release] ![GitHub Sponsors][sponsors]

```
npm i hapi-plugin-graphql
```

## Usage

```js
await server.register({
  plugin: require("hapi-plugin-graphql"),
  options: {},
});
```

## Option

`graphql`

Options that pass to `graphql`. See [graphql](https://github.com/graphql/graphql-js/blob/main/docs/APIReference-GraphQL.md#graphql).

`method`
(Optional) Set which request method it should intercept. Default to `POST`. It accepts either string or string array.

For example,

```js
{
  method: ["GET", "POST", "PUT"];
}
```

`path`

(Optional) Set the path of the GraphQL path. Default to `/graphql`.

`vhost`

(Optional) See [route.vhost](https://github.com/hapijs/hapi/blob/master/API.md#-serverrouteroute).

`route`

(Optional) See [route](https://github.com/hapijs/hapi/blob/master/API.md#route-options).

[license]: https://img.shields.io/github/license/joshuaavalon/hapi-plugin-graphql.svg
[license_badge]: https://img.shields.io/github/license/joshuaavalon/hapi-plugin-graphql.svg
[semantic_release]: https://github.com/semantic-release/semantic-release
[semantic_release_badge]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[npm]: https://www.npmjs.com/package/hapi-plugin-graphql
[npm_badge]: https://img.shields.io/npm/v/hapi-plugin-graphql
[github]: https://github.com/joshuaavalon/hapi-plugin-graphql/actions/workflows/main.yml
[github_badge]: https://github.com/joshuaavalon/hapi-plugin-graphql/actions/workflows/main/badge.svg
[sponsors]: https://img.shields.io/github/sponsors/joshuaavalon
