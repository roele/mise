import fsAsync = require("node:fs/promises");
import * as ts from "typescript";
import * as path from "path";

type GeneratorIdentifier = {
  identifier: string;
  generator_name: string;
};

const customGenerators: GeneratorIdentifier[] = [
  {
    identifier: "alias",
    generator_name: "aliasGenerator",
  },
  {
    identifier: "plugin",
    generator_name: "pluginGenerator",
  },
  {
    identifier: "all_plugins",
    generator_name: "allPluginsGenerator",
  },
  {
    identifier: "task",
    generator_name: "simpleTaskGenerator",
  },
  {
    identifier: "tasks",
    generator_name: "simpleTaskGenerator",
  },
  {
    identifier: "setting",
    generator_name: "settingsGenerator",
  },
  {
    identifier: "tool@version",
    generator_name: "toolVersionGenerator",
  },
  {
    identifier: "installed_tool@version",
    generator_name: "installedToolVersionGenerator",
  },
  {
    identifier: "config_file",
    generator_name: "configPathGenerator",
  },
  {
    identifier: "env_vars",
    generator_name: "envVarGenerator",
  },
  {
    identifier: "tool@version",
    generator_name: "toolVersionGenerator",
  },
];

const get_object_literal_name = (node: ts.Node): string => {
  if (node.kind !== ts.SyntaxKind.ObjectLiteralExpression) {
    throw "Not an Object Literal Expr";
  }

  const objectLiteralExpr = node as ts.ObjectLiteralExpression;
  let name = "";

  const properties = objectLiteralExpr.properties;
  properties.forEach((p) => {
    if (ts.isPropertyAssignment(p) && p.name.getText() == '"name"') {
      const value = p.getChildAt(2);
      name = value.getText().replaceAll('"', "");
    }
  });

  return name;
};

const get_identifier = (node: ts.Node): ts.Identifier | undefined => {
  let name = "";

  const objectLiteralExpr = node as ts.ObjectLiteralExpression;
  const properties = objectLiteralExpr.properties;
  properties.forEach((p) => {
    if (ts.isPropertyAssignment(p) && p.name.getText() == '"name"') {
      const value = p.getChildAt(2);
      name = value.getText().replaceAll('"', "");
    }
  });

  const custom = customGenerators
    .filter((g) => {
      if (name === g.identifier) {
        return true;
        //
      }
    })
    .map((g) => ts.factory.createIdentifier(g.generator_name));

  if (custom.length > 0) return custom[0];
  return;
};

const has_property = (node: ts.Node, propertyName: string): boolean => {
  if (node.kind !== ts.SyntaxKind.ObjectLiteralExpression) {
    return false;
  }

  const objectLiteralExpr = node as ts.ObjectLiteralExpression;
  const properties = objectLiteralExpr.properties;
  return properties.some(
    (p) => ts.isPropertyAssignment(p) && p.name.getText() === propertyName
  );
};

function transformer<T extends ts.Node>(context: ts.TransformationContext) {
  return (rootNode: T) => {
    function visit(node: ts.Node): ts.Node {
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText() === '"generators"'
      ) {
        const id = get_identifier(node.parent);
        if (id) {
          return ts.factory.updatePropertyAssignment(node, node.name, id);
        }
      }
      const newNode = ts.visitEachChild(node, visit, context);
      if (
        newNode &&
        has_property(newNode, '"generators"') &&
        !has_property(newNode, '"debounce"')
      ) {
        const objLiteralExpr = newNode as ts.ObjectLiteralExpression;
        const debounceProperty = ts.factory.createPropertyAssignment(
          '"debounce"',
          ts.factory.createIdentifier("true")
        );
        return ts.factory.updateObjectLiteralExpression(objLiteralExpr, [
          ...objLiteralExpr.properties,
          debounceProperty,
        ]);
      }
      return newNode;
    }
    return ts.visitNode(rootNode, visit);
  };
}

const main = async (fileName: string, outFile?: string) => {
  try {
    const generatorFileContents = (
      await fsAsync.readFile(path.join(__dirname, "generators.ts"))
    ).toString();
    const contents = (await fsAsync.readFile(fileName)).toString();
    const sourceFile = ts.createSourceFile(
      "example.ts",
      contents,
      ts.ScriptTarget.Latest,
      true
    );
    const result = ts.transform(sourceFile, [transformer]);
    const transformedSourceFile = result.transformed[0];

    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const output = printer.printNode(
      ts.EmitHint.Unspecified,
      transformedSourceFile,
      sourceFile
    );

    fsAsync.writeFile(
      outFile ?? `${fileName.replace(".ts", "")}.out.ts`,
      generatorFileContents + "\n" + output
    );
  } catch (e) {
    console.error(e);
  }
};

main(process.argv[2], process.argv[3]);
