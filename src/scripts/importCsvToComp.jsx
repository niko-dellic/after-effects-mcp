// importCsvToComp.jsx
// Imports a CSV file and lays it out as text layers in a new composition.
// args: { csvPath: string, compName?: string, compWidth?: number, compHeight?: number }

function importCsvToComp(args) {
  try {
    var csvPath = args.csvPath;
    var compName = args.compName || "Imported Data";
    var compWidth = args.compWidth || 1920;
    var compHeight = args.compHeight || 1080;
    var fontSize = args.fontSize || 24;
    var leading = args.leading || 32;
    var startX = args.startX || 200;
    var startY = args.startY || 80;

    if (!csvPath) {
      throw new Error("csvPath is required");
    }

    var file = new File(csvPath);
    if (!file.exists) {
      throw new Error("File not found: " + csvPath);
    }

    file.open("r");
    file.encoding = "UTF-8";
    var content = file.read();
    file.close();

    var lines = content.split(/\r?\n/).filter(function (line) {
      return line.length > 0;
    });
    if (lines.length === 0) {
      throw new Error("CSV is empty");
    }

    var data = [];
    for (var i = 0; i < lines.length; i++) {
      var row = [];
      var line = lines[i];
      var inQuotes = false;
      var cell = "";
      for (var j = 0; j < line.length; j++) {
        var c = line.charAt(j);
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if ((c === "," && !inQuotes) || c === "\t") {
          row.push(cell.trim());
          cell = "";
        } else {
          cell += c;
        }
      }
      row.push(cell.trim());
      data.push(row);
    }

    var comp = app.project.items.addComp(
      compName,
      compWidth,
      compHeight,
      1,
      30,
      30
    );
    var y = 0;

    for (var r = 0; r < data.length; r++) {
      var rowData = data[r];
      var isHeader = r === 0;
      var displayParts = [];
      for (var c = 0; c < rowData.length; c++) {
        var val = String(rowData[c]);
        if (
          c > 0 &&
          !isHeader &&
          (val === parseFloat(val).toString() || !isNaN(parseFloat(val)))
        ) {
          if (val.indexOf(".") !== -1) displayParts.push(val + "%");
          else displayParts.push(val);
        } else {
          displayParts.push(val.replace(/_/g, " "));
        }
      }
      var textStr = displayParts.join("   ");
      var layer = comp.layers.addText(textStr);
      layer.name = isHeader ? "Header" : "Row " + (r + 1);
      var doc = layer.property("Source Text").value;
      doc.resetCharStyle();
      doc.font = isHeader ? "Helvetica-Bold" : "Helvetica";
      doc.fontSize = fontSize;
      doc.fillColor = isHeader ? [1, 1, 1] : [0.9, 0.9, 0.9];
      layer.property("Source Text").setValue(doc);
      layer.property("Position").setValue([startX, startY + y + fontSize / 2]);
      y += leading;
    }

    return { status: "success", compName: compName, rows: data.length };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}
