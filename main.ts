// deno-lint-ignore-file no-explicit-any
import {
  Application,
  Context,
  send,
} from "https://deno.land/x/oak@v12.4.0/mod.ts";

import spec from "./spec.json" assert { type: "json" };

const proxy_paths = Array.from(Object.keys(spec.proxy_paths));

const app = new Application();

app.use(async (ctx: Context, next) => {
  const path = ctx.request.url.pathname;
  const proxy_path = proxy_paths.find((it) => path.startsWith(it));
  if (proxy_path) {
    try {
      const proxy = (spec.proxy_paths as any)[proxy_path];
      const replaced = path.replace(proxy_path, proxy);
      // console.log(`Proxying ${path} -> ${replaced}`)
      const body = ctx.request.body();
      const headers = new Headers();
      for (const key of ctx.request.headers.keys()) {
        const val = ctx.request.headers.get(key);
        if (val) {
          headers.append(key, val);
        }
      }
      const res = await fetch(replaced, {
        method: ctx.request.method as string,
        headers: headers,
        body: await body.value,
      });
      ctx.response.headers = res.headers;
      ctx.response.type = res.type;
      ctx.response.status = res.status;
      ctx.response.body = await res.blob();
      ctx.respond = true;
    } catch (error) {
      console.error("Proxy error!");
      console.error(error);
      await next();
    }
    return;
  }
  try {
    await send(ctx, path, {
      root: spec.root,
      index: spec.index,
    });
  } catch {
    await next();
  }
});

await app.listen({ port: 7163 });
