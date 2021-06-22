# hapi-plugin-graphql

```
npm i hapi-plugin-graphql
```

## Usage

```js
await server.register({
  plugin: require("hapi-plugin-graphql"),
  options: {}
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
