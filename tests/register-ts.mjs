import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/"))
      specifier = new URL(
        "../src/" + specifier.slice(2) + ".ts",
        import.meta.url,
      ).href;
    else if (specifier === "next/server") specifier = "next/server.js";
    else if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL &&
      /\/src\//.test(context.parentURL) &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      const target = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(target))) specifier = target.href;
    }
    return next(specifier, context);
  },
});
