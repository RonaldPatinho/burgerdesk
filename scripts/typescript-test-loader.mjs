import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code !== "ERR_MODULE_NOT_FOUND" ||
      !context.parentURL?.startsWith("file:") ||
      !specifier.startsWith(".")
    ) {
      throw error;
    }

    const parentDirectory = dirname(fileURLToPath(context.parentURL));
    const unresolvedPath = join(parentDirectory, specifier);
    const candidates = [`${unresolvedPath}.ts`, join(unresolvedPath, "index.ts")];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }

    throw error;
  }
}
