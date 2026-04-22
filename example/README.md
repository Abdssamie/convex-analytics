# Example app

Components need an app that uses them in order to run codegen.

An example app is also useful for testing and documentation.

Run the example and convex commands from the root of the repo.

Bootstrap default tracked site once:

```sh
npx convex run example:setupDefaultSite
```

That creates slug `default` with write key from `ANALYTICS_WRITE_KEY` or
fallback `write_demo_local`. Run once. Second run fails loud because setup is
explicit now.
