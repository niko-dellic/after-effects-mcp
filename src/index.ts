import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { fileURLToPath } from "url";

// Create an MCP server
const server = new McpServer({
  name: "AfterEffectsServer",
  version: "1.0.0",
});

// ES Modules replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths
const SCRIPTS_DIR = path.join(__dirname, "scripts");
const TEMP_DIR = path.join(__dirname, "temp");

// Headless CLI execution has been removed. All interactions are routed through the Bridge panel.

// Get the correct temp directory for the current platform
function getTempDir(): string {
  // Use /tmp on macOS/Linux (reliable, accessible by all processes)
  // Use TEMP/TMP on Windows
  if (process.platform === "darwin" || process.platform === "linux") {
    return "/tmp";
  }
  return process.env.TEMP || process.env.TMP || "/tmp";
}

// Helper function to read results from After Effects temp file
function readResultsFromTempFile(): string {
  try {
    const tempFilePath = path.join(getTempDir(), "ae_mcp_result.json");

    // Add debugging info
    console.error(`Checking for results at: ${tempFilePath}`);

    if (fs.existsSync(tempFilePath)) {
      // Get file stats to check modification time
      const stats = fs.statSync(tempFilePath);
      console.error(
        `Result file exists, last modified: ${stats.mtime.toISOString()}`
      );

      const content = fs.readFileSync(tempFilePath, "utf8");
      console.error(`Result file content length: ${content.length} bytes`);

      // If the result file is older than 30 seconds, warn the user
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
      if (stats.mtime < thirtySecondsAgo) {
        console.error(
          `WARNING: Result file is older than 30 seconds. After Effects may not be updating results.`
        );
        return JSON.stringify({
          warning: "Result file appears to be stale (not recently updated).",
          message:
            "This could indicate After Effects is not properly writing results or the MCP Bridge Auto panel isn't running.",
          lastModified: stats.mtime.toISOString(),
          originalContent: content,
        });
      }

      return content;
    } else {
      console.error(`Result file not found at: ${tempFilePath}`);
      return JSON.stringify({
        error:
          "No results file found. Please run a script in After Effects first.",
      });
    }
  } catch (error) {
    console.error("Error reading results file:", error);
    return JSON.stringify({
      error: `Failed to read results: ${String(error)}`,
    });
  }
}

// Helper to wait for a fresh result produced by a specific command
async function waitForBridgeResult(
  expectedCommand?: string,
  timeoutMs: number = 5000,
  pollMs: number = 250
): Promise<string> {
  const start = Date.now();
  const resultPath = path.join(getTempDir(), "ae_mcp_result.json");
  let lastSize = -1;

  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(resultPath)) {
      try {
        const content = fs.readFileSync(resultPath, "utf8");
        if (content && content.length > 0 && content.length !== lastSize) {
          lastSize = content.length;
          try {
            const parsed = JSON.parse(content);
            if (
              !expectedCommand ||
              parsed._commandExecuted === expectedCommand
            ) {
              return content;
            }
          } catch {
            // not JSON yet; continue polling
          }
        }
      } catch {
        // transient read error; continue polling
      }
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return JSON.stringify({
    error: `Timed out waiting for bridge result${
      expectedCommand ? ` for command '${expectedCommand}'` : ""
    }.`,
  });
}

// Helper function to write command to file
function writeCommandFile(
  command: string,
  args: Record<string, any> = {}
): void {
  try {
    const commandFile = path.join(getTempDir(), "ae_command.json");
    const commandData = {
      command,
      args,
      timestamp: new Date().toISOString(),
      status: "pending", // pending, running, completed, error
    };
    fs.writeFileSync(commandFile, JSON.stringify(commandData, null, 2));
    console.error(`Command "${command}" written to ${commandFile}`);
  } catch (error) {
    console.error("Error writing command file:", error);
  }
}

// Helper function to clear the results file to avoid stale cache
function clearResultsFile(): void {
  try {
    const resultFile = path.join(getTempDir(), "ae_mcp_result.json");

    // Write a placeholder message to indicate the file is being reset
    const resetData = {
      status: "waiting",
      message: "Waiting for new result from After Effects...",
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(resultFile, JSON.stringify(resetData, null, 2));
    console.error(`Results file cleared at ${resultFile}`);
  } catch (error) {
    console.error("Error clearing results file:", error);
  }
}

// Add a resource to expose project compositions
server.resource("compositions", "aftereffects://compositions", async (uri) => {
  // Clear old results, queue the command, and wait for bridge output
  clearResultsFile();
  writeCommandFile("listCompositions", {});
  const result = await waitForBridgeResult("listCompositions", 6000, 250);

  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: result,
      },
    ],
  };
});

// Add a tool for running read-only scripts
server.tool(
  "run-script",
  "Run a read-only script in After Effects",
  {
    script: z.string().describe("Name of the predefined script to run"),
    parameters: z
      .record(z.any())
      .optional()
      .describe("Optional parameters for the script"),
  },
  async ({ script, parameters = {} }) => {
    // Validate that script is safe (only allow predefined scripts)
    const allowedScripts = [
      "listCompositions",
      "getProjectInfo",
      "getLayerInfo",
      "createComposition",
      "createTextLayer",
      "createShapeLayer",
      "createSolidLayer",
      "setLayerProperties",
      "setLayerKeyframe",
      "setLayerExpression",
      "applyEffect",
      "applyEffectTemplate",
      "test-animation",
      "bridgeTestEffects",
      "createDiamondPlot",
      "createTypewriterEffect",
      "executeScript",
    ];

    if (!allowedScripts.includes(script)) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Script "${script}" is not allowed. Allowed scripts are: ${allowedScripts.join(
              ", "
            )}`,
          },
        ],
        isError: true,
      };
    }

    try {
      // Clear any stale result data
      clearResultsFile();

      // Write command to file for After Effects to pick up
      writeCommandFile(script, parameters);

      return {
        content: [
          {
            type: "text",
            text:
              `Command to run "${script}" has been queued.\n` +
              `Please ensure the "MCP Bridge Auto" panel is open in After Effects.\n` +
              `Use the "get-results" tool after a few seconds to check for results.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing command: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Add a tool to get the results from the last script execution
server.tool(
  "get-results",
  "Get results from the last script executed in After Effects",
  {},
  async () => {
    try {
      const result = readResultsFromTempFile();
      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting results: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Add prompts for common After Effects tasks
server.prompt(
  "list-compositions",
  "List compositions in the current After Effects project",
  () => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Please list all compositions in the current After Effects project.",
          },
        },
      ],
    };
  }
);

server.prompt(
  "analyze-composition",
  {
    compositionName: z.string().describe("Name of the composition to analyze"),
  },
  (args) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please analyze the composition named "${args.compositionName}" in the current After Effects project. Provide details about its duration, frame rate, resolution, and layers.`,
          },
        },
      ],
    };
  }
);

// Add a prompt for creating compositions
server.prompt(
  "create-composition",
  "Create a new composition with specified settings",
  () => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please create a new composition with custom settings. You can specify parameters like name, width, height, frame rate, etc.`,
          },
        },
      ],
    };
  }
);

// Add a tool to provide help and instructions
server.tool(
  "get-help",
  "Get help on using the After Effects MCP integration",
  {},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: `# After Effects MCP Integration Help

To use this integration with After Effects, follow these steps:

 1. **Install the scripts in After Effects**
   - Run \`node install-bridge.js\` with administrator privileges
   - This copies the necessary scripts to your After Effects installation

2. **Open After Effects**
   - Launch Adobe After Effects 
   - Open a project that you want to work with

3. **Open the MCP Bridge Auto panel**
   - In After Effects, go to Window > mcp-bridge-auto.jsx
   - The panel will automatically check for commands every few seconds

4. **Run scripts through MCP**
   - Use the \`run-script\` tool to queue a command
   - The Auto panel will detect and run the command automatically
   - Results will be saved to a temp file

5. **Get results through MCP**
   - After a command is executed, use the \`get-results\` tool
   - This will retrieve the results from After Effects

Available scripts:
- getProjectInfo: Information about the current project
- listCompositions: List all compositions in the project
- getLayerInfo: Information about layers in the active composition
- createComposition: Create a new composition
- createTextLayer: Create a new text layer
- createShapeLayer: Create a new shape layer
- createSolidLayer: Create a new solid layer
- setLayerProperties: Set properties for a layer
- setLayerKeyframe: Set a keyframe for a layer property
- setLayerExpression: Set an expression for a layer property
- applyEffect: Apply an effect to a layer
- applyEffectTemplate: Apply a predefined effect template to a layer

Effect Templates:
- gaussian-blur: Simple Gaussian blur effect
- directional-blur: Motion blur in a specific direction
- color-balance: Adjust hue, lightness, and saturation
- brightness-contrast: Basic brightness and contrast adjustment
- curves: Advanced color adjustment using curves
- glow: Add a glow effect to elements
- drop-shadow: Add a customizable drop shadow
- cinematic-look: Combination of effects for a cinematic appearance
- text-pop: Effects to make text stand out (glow and shadow)

Note: The auto-running panel can be left open in After Effects to continuously listen for commands from external applications.`,
        },
      ],
    };
  }
);

// Add a tool specifically for creating compositions
server.tool(
  "create-composition",
  "Create a new composition in After Effects with specified parameters",
  {
    name: z.string().describe("Name of the composition"),
    width: z
      .number()
      .int()
      .positive()
      .describe("Width of the composition in pixels"),
    height: z
      .number()
      .int()
      .positive()
      .describe("Height of the composition in pixels"),
    pixelAspect: z
      .number()
      .positive()
      .optional()
      .describe("Pixel aspect ratio (default: 1.0)"),
    duration: z
      .number()
      .positive()
      .optional()
      .describe("Duration in seconds (default: 10.0)"),
    frameRate: z
      .number()
      .positive()
      .optional()
      .describe("Frame rate in frames per second (default: 30.0)"),
    backgroundColor: z
      .object({
        r: z.number().int().min(0).max(255),
        g: z.number().int().min(0).max(255),
        b: z.number().int().min(0).max(255),
      })
      .optional()
      .describe("Background color of the composition (RGB values 0-255)"),
  },
  async (params) => {
    try {
      // Write command to file for After Effects to pick up
      writeCommandFile("createComposition", params);

      return {
        content: [
          {
            type: "text",
            text:
              `Command to create composition "${params.name}" has been queued.\n` +
              `Please ensure the "MCP Bridge Auto" panel is open in After Effects.\n` +
              `Use the "get-results" tool after a few seconds to check for results.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing composition creation: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// --- BEGIN NEW TOOLS ---

// Zod schema for common layer identification
const LayerIdentifierSchema = {
  compIndex: z
    .number()
    .int()
    .positive()
    .describe("1-based index of the target composition in the project panel."),
  layerIndex: z
    .number()
    .int()
    .positive()
    .describe("1-based index of the target layer within the composition."),
};

// Zod schema for keyframe value (more specific types might be needed depending on property)
// Using z.any() for flexibility, but can be refined (e.g., z.array(z.number()) for position/scale)
const KeyframeValueSchema = z
  .any()
  .describe(
    "The value for the keyframe (e.g., [x,y] for Position, [w,h] for Scale, angle for Rotation, percentage for Opacity)"
  );

// Tool for setting a layer keyframe
server.tool(
  "setLayerKeyframe", // Corresponds to the function name in ExtendScript
  "Set a keyframe for a specific layer property at a given time.",
  {
    ...LayerIdentifierSchema, // Reuse common identifiers
    propertyName: z
      .string()
      .describe(
        "Name of the property to keyframe (e.g., 'Position', 'Scale', 'Rotation', 'Opacity')."
      ),
    timeInSeconds: z
      .number()
      .describe("The time (in seconds) for the keyframe."),
    value: KeyframeValueSchema,
  },
  async (parameters) => {
    try {
      // Queue the command for After Effects
      writeCommandFile("setLayerKeyframe", parameters);

      return {
        content: [
          {
            type: "text",
            text:
              `Command to set keyframe for "${parameters.propertyName}" on layer ${parameters.layerIndex} in comp ${parameters.compIndex} has been queued.\n` +
              `Use the "get-results" tool after a few seconds to check for confirmation.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing setLayerKeyframe command: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool for setting a layer expression
server.tool(
  "setLayerExpression", // Corresponds to the function name in ExtendScript
  "Set or remove an expression for a specific layer property.",
  {
    ...LayerIdentifierSchema, // Reuse common identifiers
    propertyName: z
      .string()
      .describe(
        "Name of the property to apply the expression to (e.g., 'Position', 'Scale', 'Rotation', 'Opacity')."
      ),
    expressionString: z
      .string()
      .describe(
        'The JavaScript expression string. Provide an empty string ("") to remove the expression.'
      ),
  },
  async (parameters) => {
    try {
      // Queue the command for After Effects
      writeCommandFile("setLayerExpression", parameters);

      return {
        content: [
          {
            type: "text",
            text:
              `Command to set expression for "${parameters.propertyName}" on layer ${parameters.layerIndex} in comp ${parameters.compIndex} has been queued.\n` +
              `Use the "get-results" tool after a few seconds to check for confirmation.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing setLayerExpression command: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// --- END NEW TOOLS ---

// --- BEGIN NEW TESTING TOOL ---
// Add a special tool for directly testing the keyframe functionality
server.tool(
  "test-animation",
  "Test animation functionality in After Effects",
  {
    operation: z
      .enum(["keyframe", "expression"])
      .describe("The animation operation to test"),
    compIndex: z
      .number()
      .int()
      .positive()
      .describe("Composition index (usually 1)"),
    layerIndex: z.number().int().positive().describe("Layer index (usually 1)"),
  },
  async (params) => {
    try {
      // Generate a unique timestamp
      const timestamp = new Date().getTime();
      const tempFile = path.join(getTempDir(), `ae_test_${timestamp}.jsx`);

      // Create a direct test script that doesn't rely on command files
      let scriptContent = "";
      if (params.operation === "keyframe") {
        scriptContent = `
          // Direct keyframe test script
          try {
            var comp = app.project.items[${params.compIndex}];
            var layer = comp.layers[${params.layerIndex}];
            var prop = layer.property("Transform").property("Opacity");
            var time = 1; // 1 second
            var value = 25; // 25% opacity
            
            // Set a keyframe
            prop.setValueAtTime(time, value);
            
            // Write direct result
            var resultFile = new File("${path
              .join(getTempDir(), "ae_test_result.txt")
              .replace(/\\/g, "\\\\")}");
            resultFile.open("w");
            resultFile.write("SUCCESS: Added keyframe at time " + time + " with value " + value);
            resultFile.close();
            
            // Visual feedback
            alert("Test successful: Added opacity keyframe at " + time + "s with value " + value + "%");
          } catch (e) {
            var errorFile = new File("${path
              .join(getTempDir(), "ae_test_error.txt")
              .replace(/\\/g, "\\\\")}");
            errorFile.open("w");
            errorFile.write("ERROR: " + e.toString());
            errorFile.close();
            
            alert("Test failed: " + e.toString());
          }
        `;
      } else if (params.operation === "expression") {
        scriptContent = `
          // Direct expression test script
          try {
            var comp = app.project.items[${params.compIndex}];
            var layer = comp.layers[${params.layerIndex}];
            var prop = layer.property("Transform").property("Position");
            var expression = "wiggle(3, 30)";
            
            // Set the expression
            prop.expression = expression;
            
            // Write direct result
            var resultFile = new File("${path
              .join(getTempDir(), "ae_test_result.txt")
              .replace(/\\/g, "\\\\")}");
            resultFile.open("w");
            resultFile.write("SUCCESS: Added expression: " + expression);
            resultFile.close();
            
            // Visual feedback
            alert("Test successful: Added position expression: " + expression);
          } catch (e) {
            var errorFile = new File("${path
              .join(getTempDir(), "ae_test_error.txt")
              .replace(/\\/g, "\\\\")}");
            errorFile.open("w");
            errorFile.write("ERROR: " + e.toString());
            errorFile.close();
            
            alert("Test failed: " + e.toString());
          }
        `;
      }

      // Write the script to a temp file
      fs.writeFileSync(tempFile, scriptContent);
      console.error(`Written test script to: ${tempFile}`);

      // Tell the user what to do
      return {
        content: [
          {
            type: "text",
            text: `I've created a direct test script for the ${params.operation} operation.

Please run this script manually in After Effects:
1. In After Effects, go to File > Scripts > Run Script File...
2. Navigate to: ${tempFile}
3. You should see an alert confirming the result.

This bypasses the MCP Bridge Auto panel and will directly modify the specified layer.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating test script: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);
// --- END NEW TESTING TOOL ---

// --- BEGIN NEW EFFECTS TOOLS ---

// Add a tool for applying effects to layers
server.tool(
  "apply-effect",
  "Apply an effect to a layer in After Effects",
  {
    compIndex: z
      .number()
      .int()
      .positive()
      .describe(
        "1-based index of the target composition in the project panel."
      ),
    layerIndex: z
      .number()
      .int()
      .positive()
      .describe("1-based index of the target layer within the composition."),
    effectName: z
      .string()
      .optional()
      .describe("Display name of the effect to apply (e.g., 'Gaussian Blur')."),
    effectMatchName: z
      .string()
      .optional()
      .describe(
        "After Effects internal name for the effect (more reliable, e.g., 'ADBE Gaussian Blur 2')."
      ),
    effectCategory: z
      .string()
      .optional()
      .describe("Optional category for filtering effects."),
    presetPath: z
      .string()
      .optional()
      .describe("Optional path to an effect preset file (.ffx)."),
    effectSettings: z
      .record(z.any())
      .optional()
      .describe(
        "Optional parameters for the effect (e.g., { 'Blurriness': 25 })."
      ),
  },
  async (parameters) => {
    try {
      // Queue the command for After Effects
      writeCommandFile("applyEffect", parameters);

      return {
        content: [
          {
            type: "text",
            text:
              `Command to apply effect to layer ${parameters.layerIndex} in composition ${parameters.compIndex} has been queued.\n` +
              `Use the "get-results" tool after a few seconds to check for confirmation.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing apply-effect command: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Add a tool for applying effect templates
server.tool(
  "apply-effect-template",
  "Apply a predefined effect template to a layer in After Effects",
  {
    compIndex: z
      .number()
      .int()
      .positive()
      .describe(
        "1-based index of the target composition in the project panel."
      ),
    layerIndex: z
      .number()
      .int()
      .positive()
      .describe("1-based index of the target layer within the composition."),
    templateName: z
      .enum([
        "gaussian-blur",
        "directional-blur",
        "color-balance",
        "brightness-contrast",
        "curves",
        "glow",
        "drop-shadow",
        "cinematic-look",
        "text-pop",
      ])
      .describe("Name of the effect template to apply."),
    customSettings: z
      .record(z.any())
      .optional()
      .describe("Optional custom settings to override defaults."),
  },
  async (parameters) => {
    try {
      // Queue the command for After Effects
      writeCommandFile("applyEffectTemplate", parameters);

      return {
        content: [
          {
            type: "text",
            text:
              `Command to apply effect template '${parameters.templateName}' to layer ${parameters.layerIndex} in composition ${parameters.compIndex} has been queued.\n` +
              `Use the "get-results" tool after a few seconds to check for confirmation.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing apply-effect-template command: ${String(
              error
            )}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// --- END NEW EFFECTS TOOLS ---

// --- DYNAMIC SCRIPT EXECUTION TOOL ---
server.tool(
  "execute-script",
  "Execute arbitrary ExtendScript code in After Effects. Use for prototyping or one-off operations.",
  {
    code: z
      .string()
      .describe(
        "ExtendScript code to execute in After Effects. Can be multiple statements. Return a value or JSON string for structured results."
      ),
    waitTime: z
      .number()
      .optional()
      .describe(
        "Milliseconds to wait for execution (default: 3000). Increase for long-running scripts."
      ),
  },
  async (params) => {
    try {
      clearResultsFile();
      writeCommandFile("executeScript", { code: params.code });

      // Wait for After Effects to process
      const waitMs = params.waitTime || 3000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));

      const result = readResultsFromTempFile();

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing script: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// --- IMPORT CSV / FORMAT CSV TO TABLE ---
function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
  const rows: string[][] = [];
  for (const line of lines) {
    const row: string[] = [];
    let cell = "";
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === "," || c === "\t") && !inQuotes) {
        row.push(cell.trim());
        cell = "";
      } else {
        cell += c;
      }
    }
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

type TableFormatOptions = {
  compName: string;
  compWidth: number;
  compHeight: number;
  left: number;
  top: number;
  colWidths: number[];
  rowHeight: number;
  padH: number;
  fontSize: number;
  strokeWidth: number;
  borderColor: [number, number, number];
};

function buildTableFormatScript(
  data: string[][],
  options: Partial<TableFormatOptions> = {}
): string {
  const numCols = data[0]?.length ?? 3;
  const colW =
    options.colWidths ??
    Array(numCols)
      .fill(0)
      .map((_, i) => (i === 0 ? 720 : 100));
  const rowH = options.rowHeight ?? 36;
  const padH = options.padH ?? 12;
  const left = options.left ?? 200;
  const top = options.top ?? 80;
  const totalW = colW.reduce((a, b) => a + b, 0);
  const totalH = data.length * rowH;
  const strokeW = options.strokeWidth ?? 1.5;
  const borderColor = options.borderColor ?? [0.6, 0.6, 0.65];
  const compNameForScript = JSON.stringify(options.compName ?? "CSV Table");
  const fontSize = options.fontSize ?? 20;
  const dataJson = JSON.stringify(data);

  let code = `
var data = ${dataJson};
var compName = ${compNameForScript};
var comp = app.project.items.addComp(compName, ${options.compWidth ?? 1920}, ${
    options.compHeight ?? 1080
  }, 1, 30, 30);
var colW = ${JSON.stringify(colW)};
var rowH = ${rowH};
var padH = ${padH};
var left = ${left};
var top = ${top};
var totalW = ${totalW};
var totalH = ${totalH};
var strokeW = ${strokeW};
var borderColor = ${JSON.stringify(borderColor)};
var shapeLayer = comp.layers.addShape();
shapeLayer.name = "Table Border";
var contents = shapeLayer.property("Contents");
var outer = contents.addProperty("ADBE Vector Group");
outer.name = "Outer";
var rect = outer.property("Contents").addProperty("ADBE Vector Shape - Rect");
rect.property("Size").setValue([totalW, totalH]);
rect.property("Position").setValue([totalW/2, totalH/2]);
var stroke = outer.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
stroke.property("Stroke Width").setValue(strokeW);
stroke.property("Color").setValue(borderColor);
`;
  for (let r = 1; r < data.length; r++) {
    const y = r * rowH;
    code += `
var lineGroup${r} = contents.addProperty("ADBE Vector Group");
lineGroup${r}.name = "H${r}";
var pathProp${r} = lineGroup${r}.property("Contents").addProperty("ADBE Vector Shape - Group");
var lineShape${r} = new Shape();
lineShape${r}.vertices = [[0, ${y}], [totalW, ${y}]];
lineShape${r}.closed = false;
pathProp${r}.property("Path").setValue(lineShape${r});
var lineStroke${r} = lineGroup${r}.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
lineStroke${r}.property("Stroke Width").setValue(strokeW);
lineStroke${r}.property("Color").setValue(borderColor);
`;
  }
  for (let c = 1; c < colW.length; c++) {
    const x = colW.slice(0, c).reduce((a: number, b: number) => a + b, 0);
    code += `
var vGroup${c} = contents.addProperty("ADBE Vector Group");
vGroup${c}.name = "V${c}";
var vPath${c} = vGroup${c}.property("Contents").addProperty("ADBE Vector Shape - Group");
var vShape${c} = new Shape();
vShape${c}.vertices = [[${x}, 0], [${x}, totalH]];
vShape${c}.closed = false;
vPath${c}.property("Path").setValue(vShape${c});
var vStroke${c} = vGroup${c}.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
vStroke${c}.property("Stroke Width").setValue(strokeW);
vStroke${c}.property("Color").setValue(borderColor);
`;
  }
  code += `
shapeLayer.property("Position").setValue([left + totalW/2, top + totalH/2]);
var fontSize = ${fontSize};
var numCols = ${numCols};
for (var i = 0; i < data.length; i++) {
  var row = data[i];
  var isHeader = (i === 0);
  var yPos = top + i * rowH + rowH/2;
  for (var col = 0; col < row.length && col < numCols; col++) {
    var val = String(row[col]);
    if (!isHeader && col === 1) val = val + "%";
    if (!isHeader && col === 2) val = val + " min";
    if (col === 0) val = val.replace(/_/g, " ");
    var layer = comp.layers.addText(val);
    layer.name = (isHeader ? "Header" : "Row" + (i+1)) + "_Col" + (col+1);
    var doc = layer.property("Source Text").value;
    doc.resetCharStyle();
    doc.font = isHeader ? "Helvetica-Bold" : "Helvetica";
    doc.fontSize = fontSize;
    doc.fillColor = isHeader ? [0.2, 0.2, 0.25] : [0.15, 0.15, 0.2];
    if (col === 0) doc.justification = ParagraphJustification.LEFT_JUSTIFY;
    else doc.justification = ParagraphJustification.CENTER_JUSTIFY;
    layer.property("Source Text").setValue(doc);
    var cx = col === 0 ? left + padH + (colW[0]-padH*2)/2 : (col === 1 ? left + colW[0] + colW[1]/2 : left + colW[0] + colW[1] + colW[2]/2);
    if (numCols > 3) { var sum = 0; for (var k = 0; k < col; k++) sum += colW[k]; cx = left + sum + colW[col]/2; }
    layer.property("Position").setValue([cx, yPos]);
  }
}
JSON.stringify({ status: "success", compName: compName, rows: data.length });
`;
  return code;
}

server.tool(
  "import-csv",
  "Import a CSV file and lay it out as text layers in a new composition. Each row becomes a text layer; first row is styled as header.",
  {
    csvPath: z
      .string()
      .describe("Path to the CSV file (e.g. program_access.csv or full path)"),
    compName: z
      .string()
      .optional()
      .describe(
        "Name of the new composition (default: from filename or 'Imported Data')"
      ),
    compWidth: z
      .number()
      .optional()
      .describe("Composition width in pixels (default: 1920)"),
    compHeight: z
      .number()
      .optional()
      .describe("Composition height in pixels (default: 1080)"),
    fontSize: z
      .number()
      .optional()
      .describe("Font size for text layers (default: 24)"),
    leading: z
      .number()
      .optional()
      .describe("Vertical spacing between rows (default: 32)"),
    startX: z
      .number()
      .optional()
      .describe("Left margin / start X for text (default: 200)"),
    startY: z
      .number()
      .optional()
      .describe("Top margin / start Y (default: 80)"),
  },
  async (params) => {
    try {
      const resolvedPath = path.isAbsolute(params.csvPath)
        ? params.csvPath
        : path.resolve(process.cwd(), params.csvPath);
      if (!fs.existsSync(resolvedPath)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `CSV file not found: ${resolvedPath}`,
            },
          ],
          isError: true,
        };
      }
      const content = fs.readFileSync(resolvedPath, "utf8");
      const data = parseCSV(content);
      if (data.length === 0) {
        return {
          content: [{ type: "text" as const, text: "CSV is empty." }],
          isError: true,
        };
      }
      const compName =
        params.compName ||
        path.basename(resolvedPath, ".csv").replace(/-/g, " ") ||
        "Imported Data";
      const compWidth = params.compWidth ?? 1920;
      const compHeight = params.compHeight ?? 1080;
      const fontSize = params.fontSize ?? 24;
      const leading = params.leading ?? 32;
      const startX = params.startX ?? 200;
      const startY = params.startY ?? 80;
      const dataJson = JSON.stringify(data);
      const code = `
var data = ${dataJson};
var comp = app.project.items.addComp("${compName.replace(
        /"/g,
        '\\"'
      )}", ${compWidth}, ${compHeight}, 1, 30, 30);
var fontSize = ${fontSize};
var leading = ${leading};
var startX = ${startX};
var startY = ${startY};
for (var i = 0; i < data.length; i++) {
  var row = data[i];
  var isHeader = (i === 0);
  var parts = [];
  for (var c = 0; c < row.length; c++) {
    var val = String(row[c]);
    if (isHeader) parts.push(val);
    else if (c === 0) parts.push(val.replace(/_/g, " "));
    else if (c === 1) parts.push(val + "%");
    else if (c === 2) parts.push(val + " min");
    else parts.push(val);
  }
  var textStr = parts.join("   ");
  var layer = comp.layers.addText(textStr);
  layer.name = isHeader ? "Header" : "Row " + (i + 1);
  var doc = layer.property("Source Text").value;
  doc.resetCharStyle();
  doc.font = isHeader ? "Helvetica-Bold" : "Helvetica";
  doc.fontSize = fontSize;
  doc.fillColor = isHeader ? [1,1,1] : [0.9,0.9,0.9];
  layer.property("Source Text").setValue(doc);
  layer.property("Position").setValue([startX, startY + i * leading + fontSize/2]);
}
JSON.stringify({ status: "success", compName: "${compName.replace(
        /"/g,
        '\\"'
      )}", rows: data.length });
`;
      clearResultsFile();
      writeCommandFile("executeScript", { code });
      await new Promise((r) => setTimeout(r, 8000));
      const result = readResultsFromTempFile();
      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error importing CSV: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// --- FORMAT CSV TEXT TO TABLE (multiline CSV string -> bordered table comp) ---
server.tool(
  "format-csv-to-table",
  "Parse multiline CSV text and create a new composition with a bordered table layout. First row is the header. Pass the raw CSV content as a string.",
  {
    csvText: z
      .string()
      .describe(
        "Multiline CSV content (e.g. 'Program,Percentage,TravelTime\\nLOWER_SCHOOL,29.3,10.2\\n...')"
      ),
    compName: z
      .string()
      .optional()
      .describe("Name of the new composition (default: 'CSV Table')"),
    compWidth: z
      .number()
      .optional()
      .describe("Composition width (default: 1920)"),
    compHeight: z
      .number()
      .optional()
      .describe("Composition height (default: 1080)"),
    left: z.number().optional().describe("Table left margin (default: 200)"),
    top: z.number().optional().describe("Table top margin (default: 80)"),
    rowHeight: z
      .number()
      .optional()
      .describe("Row height in pixels (default: 36)"),
    fontSize: z.number().optional().describe("Font size (default: 20)"),
    colWidths: z
      .array(z.number())
      .optional()
      .describe(
        "Column widths in pixels (default: first column 720, others 100 each)"
      ),
  },
  async (params) => {
    try {
      const data = parseCSV(params.csvText);
      if (data.length === 0) {
        return {
          content: [{ type: "text" as const, text: "CSV text is empty." }],
          isError: true,
        };
      }
      const numCols = data[0].length;
      const colWidths =
        params.colWidths ??
        (numCols > 0
          ? [720, ...Array(Math.max(0, numCols - 1)).fill(100)]
          : [720, 100, 100]);
      const code = buildTableFormatScript(data, {
        compName: params.compName ?? "CSV Table",
        compWidth: params.compWidth ?? 1920,
        compHeight: params.compHeight ?? 1080,
        left: params.left ?? 200,
        top: params.top ?? 80,
        rowHeight: params.rowHeight ?? 36,
        fontSize: params.fontSize ?? 20,
        colWidths,
      });
      clearResultsFile();
      writeCommandFile("executeScript", { code });
      await new Promise((r) => setTimeout(r, 12000));
      const result = readResultsFromTempFile();
      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error formatting CSV to table: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// --- TYPEWRITER EFFECT TOOL ---
server.tool(
  "create-typewriter-effect",
  "Create a typewriter text effect with blinking cursor for Premiere Pro MOGRTs",
  {
    compName: z
      .string()
      .optional()
      .describe("Name of the composition (uses active comp if not specified)"),
    text: z
      .string()
      .optional()
      .describe("The text to type (default: 'Hello World')"),
    position: z
      .array(z.number())
      .optional()
      .describe("Position [x, y] of the text (default: [960, 540])"),
    fontSize: z
      .number()
      .optional()
      .describe("Font size in pixels (default: 72)"),
    fontFamily: z
      .string()
      .optional()
      .describe("Font family name (default: 'Courier New')"),
    textColor: z
      .array(z.number())
      .optional()
      .describe("Text color as [r, g, b] from 0-1 (default: white)"),
    cursorChar: z
      .string()
      .optional()
      .describe("Character to use as cursor (default: '|')"),
    cursorBlinkSpeed: z
      .number()
      .optional()
      .describe("Cursor blinks per second (default: 2)"),
    preTypeDelay: z
      .number()
      .optional()
      .describe("Seconds to wait before typing starts (default: 1)"),
    typeSpeed: z
      .number()
      .optional()
      .describe("Characters typed per second (default: 10)"),
    showDuration: z
      .number()
      .optional()
      .describe("Seconds to show full text before backspace (default: 2)"),
    showCursorDuringDisplay: z
      .boolean()
      .optional()
      .describe("Show blinking cursor while text is displayed (default: true)"),
    backspaceSpeed: z
      .number()
      .optional()
      .describe("Characters deleted per second (default: 15)"),
    postDeleteDelay: z
      .number()
      .optional()
      .describe("Seconds to show cursor after text is deleted (default: 0.5)"),
    cursorOffset: z
      .number()
      .optional()
      .describe("Pixel offset between last character and cursor (default: 5)"),
  },
  async (params) => {
    try {
      clearResultsFile();
      writeCommandFile("createTypewriterEffect", params);

      // Wait for After Effects to process
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const result = readResultsFromTempFile();

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating typewriter effect: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// --- DIAMOND PLOT TOOL ---
server.tool(
  "create-diamond-plot",
  "Create a diamond/radar chart with controllable metrics for Premiere Pro Essential Graphics",
  {
    compName: z
      .string()
      .optional()
      .describe("Name of the composition (uses active comp if not specified)"),
    numPoints: z
      .number()
      .int()
      .min(3)
      .max(12)
      .optional()
      .describe("Number of points/metrics in the diamond (default: 3)"),
    metricNames: z
      .array(z.string())
      .optional()
      .describe("Names for each metric (e.g., ['Speed', 'Power', 'Accuracy'])"),
    metricValues: z
      .array(z.number())
      .optional()
      .describe("Initial values for each metric (0-100, default: 50)"),
    maxValue: z
      .number()
      .optional()
      .describe("Maximum value for metrics (default: 100)"),
    radius: z
      .number()
      .optional()
      .describe("Radius of the chart in pixels (default: 200)"),
    centerX: z
      .number()
      .optional()
      .describe("X position of chart center (default: 960)"),
    centerY: z
      .number()
      .optional()
      .describe("Y position of chart center (default: 540)"),
    fillColor: z
      .array(z.number())
      .optional()
      .describe("Fill color as [r, g, b] from 0-1 (default: light blue)"),
    strokeColor: z
      .array(z.number())
      .optional()
      .describe("Stroke color as [r, g, b] from 0-1"),
    strokeWidth: z
      .number()
      .optional()
      .describe("Stroke width in pixels (default: 3)"),
    fillOpacity: z
      .number()
      .optional()
      .describe("Fill opacity 0-100 (default: 50)"),
    showLabels: z
      .boolean()
      .optional()
      .describe("Show metric name labels (default: true)"),
    showValues: z
      .boolean()
      .optional()
      .describe("Show metric value numbers (default: true)"),
    labelFontSize: z
      .number()
      .optional()
      .describe("Font size for labels (default: 24)"),
    valueFontSize: z
      .number()
      .optional()
      .describe("Font size for values (default: 18)"),
  },
  async (params) => {
    try {
      clearResultsFile();
      writeCommandFile("createDiamondPlot", params);

      // Wait for After Effects to process
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const result = readResultsFromTempFile();

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating diamond plot: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Add direct MCP function for applying effects
server.tool(
  "mcp_aftereffects_applyEffect",
  "Apply an effect to a layer in After Effects",
  {
    compIndex: z
      .number()
      .int()
      .positive()
      .describe(
        "1-based index of the target composition in the project panel."
      ),
    layerIndex: z
      .number()
      .int()
      .positive()
      .describe("1-based index of the target layer within the composition."),
    effectName: z
      .string()
      .optional()
      .describe("Display name of the effect to apply (e.g., 'Gaussian Blur')."),
    effectMatchName: z
      .string()
      .optional()
      .describe(
        "After Effects internal name for the effect (more reliable, e.g., 'ADBE Gaussian Blur 2')."
      ),
    effectSettings: z
      .record(z.any())
      .optional()
      .describe(
        "Optional parameters for the effect (e.g., { 'Blurriness': 25 })."
      ),
  },
  async (parameters) => {
    try {
      // Queue the command for After Effects
      writeCommandFile("applyEffect", parameters);

      // Wait a bit for After Effects to process the command
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get the results
      const result = readResultsFromTempFile();

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error applying effect: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Add direct MCP function for applying effect templates
server.tool(
  "mcp_aftereffects_applyEffectTemplate",
  "Apply a predefined effect template to a layer in After Effects",
  {
    compIndex: z
      .number()
      .int()
      .positive()
      .describe(
        "1-based index of the target composition in the project panel."
      ),
    layerIndex: z
      .number()
      .int()
      .positive()
      .describe("1-based index of the target layer within the composition."),
    templateName: z
      .enum([
        "gaussian-blur",
        "directional-blur",
        "color-balance",
        "brightness-contrast",
        "curves",
        "glow",
        "drop-shadow",
        "cinematic-look",
        "text-pop",
      ])
      .describe("Name of the effect template to apply."),
    customSettings: z
      .record(z.any())
      .optional()
      .describe("Optional custom settings to override defaults."),
  },
  async (parameters) => {
    try {
      // Queue the command for After Effects
      writeCommandFile("applyEffectTemplate", parameters);

      // Wait a bit for After Effects to process the command
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get the results
      const result = readResultsFromTempFile();

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error applying effect template: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Update help information to include the new effects tools
server.tool(
  "mcp_aftereffects_get_effects_help",
  "Get help on using After Effects effects",
  {},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: `# After Effects Effects Help

## Common Effect Match Names
These are internal names used by After Effects that can be used with the \`effectMatchName\` parameter:

### Blur & Sharpen
- Gaussian Blur: "ADBE Gaussian Blur 2"
- Camera Lens Blur: "ADBE Camera Lens Blur"
- Directional Blur: "ADBE Directional Blur"
- Radial Blur: "ADBE Radial Blur"
- Smart Blur: "ADBE Smart Blur"
- Unsharp Mask: "ADBE Unsharp Mask"

### Color Correction
- Brightness & Contrast: "ADBE Brightness & Contrast 2"
- Color Balance: "ADBE Color Balance (HLS)"
- Color Balance (RGB): "ADBE Pro Levels2"
- Curves: "ADBE CurvesCustom"
- Exposure: "ADBE Exposure2"
- Hue/Saturation: "ADBE HUE SATURATION"
- Levels: "ADBE Pro Levels2"
- Vibrance: "ADBE Vibrance"

### Stylistic
- Glow: "ADBE Glow"
- Drop Shadow: "ADBE Drop Shadow"
- Bevel Alpha: "ADBE Bevel Alpha"
- Noise: "ADBE Noise"
- Fractal Noise: "ADBE Fractal Noise"
- CC Particle World: "CC Particle World"
- CC Light Sweep: "CC Light Sweep"

## Effect Templates
The following predefined effect templates are available:

- \`gaussian-blur\`: Simple Gaussian blur effect
- \`directional-blur\`: Motion blur in a specific direction
- \`color-balance\`: Adjust hue, lightness, and saturation
- \`brightness-contrast\`: Basic brightness and contrast adjustment
- \`curves\`: Advanced color adjustment using curves
- \`glow\`: Add a glow effect to elements
- \`drop-shadow\`: Add a customizable drop shadow
- \`cinematic-look\`: Combination of effects for a cinematic appearance
- \`text-pop\`: Effects to make text stand out (glow and shadow)

## Example Usage
To apply a Gaussian blur effect:

\`\`\`json
{
  "compIndex": 1,
  "layerIndex": 1,
  "effectMatchName": "ADBE Gaussian Blur 2",
  "effectSettings": {
    "Blurriness": 25
  }
}
\`\`\`

To apply the "cinematic-look" template:

\`\`\`json
{
  "compIndex": 1,
  "layerIndex": 1,
  "templateName": "cinematic-look"
}
\`\`\`
`,
        },
      ],
    };
  }
);

// Add a direct tool for our bridge test effects
server.tool(
  "run-bridge-test",
  "Run the bridge test effects script to verify communication and apply test effects",
  {},
  async () => {
    try {
      // Clear any stale result data
      clearResultsFile();

      // Write command to file for After Effects to pick up
      writeCommandFile("bridgeTestEffects", {});

      return {
        content: [
          {
            type: "text",
            text:
              `Bridge test effects command has been queued.\n` +
              `Please ensure the "MCP Bridge Auto" panel is open in After Effects.\n` +
              `Use the "get-results" tool after a few seconds to check for the test results.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing bridge test command: ${String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Start the MCP server
async function main() {
  console.error("After Effects MCP Server starting...");
  console.error(`Scripts directory: ${SCRIPTS_DIR}`);
  console.error(`Temp directory: ${TEMP_DIR}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("After Effects MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
