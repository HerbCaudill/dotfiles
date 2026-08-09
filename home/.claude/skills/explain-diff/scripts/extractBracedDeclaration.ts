import ts from "typescript"
import type { BracedDeclaration } from "./types.ts"

/** Extract one complete JavaScript or TypeScript declaration and its adjacent JSDoc comment. */
export function extractBracedDeclaration(
  source: string,
  needle: string,
  filePath = "explanation-source.ts",
): BracedDeclaration {
  const needleStart = source.indexOf(needle)
  if (needleStart < 0) throw new Error(`Could not find declaration: ${needle}`)

  const lowerFilePath = filePath.toLowerCase()
  const scriptKind = lowerFilePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : lowerFilePath.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : lowerFilePath.endsWith(".js") ||
          lowerFilePath.endsWith(".mjs") ||
          lowerFilePath.endsWith(".cjs")
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind)
  const candidates: ts.Node[] = []
  const pending: ts.Node[] = [sourceFile]

  while (pending.length > 0) {
    const node = pending.pop()
    if (!node) continue
    const start = node.getStart(sourceFile)
    if (start > needleStart || node.end <= needleStart) continue

    const supported =
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isVariableStatement(node) ||
      ts.isObjectLiteralExpression(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isModuleDeclaration(node)
    if (supported) candidates.push(node)
    node.forEachChild(child => {
      pending.push(child)
    })
  }

  const declaration = candidates.sort(
    (left, right) =>
      left.end - left.getStart(sourceFile) - (right.end - right.getStart(sourceFile)),
  )[0]
  if (!declaration) throw new Error(`Could not find complete declaration: ${needle}`)

  const declarationStart = declaration.getStart(sourceFile)
  let snippetStart = declarationStart
  const commentEnd = source.lastIndexOf("*/", declarationStart)
  if (commentEnd >= 0 && source.slice(commentEnd + 2, declarationStart).trim() === "") {
    const commentStart = source.lastIndexOf("/**", commentEnd)
    if (commentStart >= 0) snippetStart = commentStart
  }

  return {
    line: source.slice(0, snippetStart).split("\n").length,
    text: source.slice(snippetStart, declaration.end).trimEnd(),
  }
}
