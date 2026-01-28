// mcp-bridge-auto.jsx
// Auto-running MCP Bridge panel for After Effects

// Remove #include directives as we define functions below
/*
#include "createComposition.jsx"
#include "createTextLayer.jsx"
#include "createShapeLayer.jsx"
#include "createSolidLayer.jsx"
#include "setLayerProperties.jsx"
*/

// --- Function Definitions ---

// --- createComposition (from createComposition.jsx) --- 
function createComposition(args) {
    try {
        var name = args.name || "New Composition";
        var width = parseInt(args.width) || 1920;
        var height = parseInt(args.height) || 1080;
        var pixelAspect = parseFloat(args.pixelAspect) || 1.0;
        var duration = parseFloat(args.duration) || 10.0;
        var frameRate = parseFloat(args.frameRate) || 30.0;
        var bgColor = args.backgroundColor ? [args.backgroundColor.r/255, args.backgroundColor.g/255, args.backgroundColor.b/255] : [0, 0, 0];
        var newComp = app.project.items.addComp(name, width, height, pixelAspect, duration, frameRate);
        if (args.backgroundColor) {
            newComp.bgColor = bgColor;
        }
        return JSON.stringify({
            status: "success", message: "Composition created successfully",
            composition: { name: newComp.name, id: newComp.id, width: newComp.width, height: newComp.height, pixelAspect: newComp.pixelAspect, duration: newComp.duration, frameRate: newComp.frameRate, bgColor: newComp.bgColor }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- createTextLayer (from createTextLayer.jsx) ---
function createTextLayer(args) {
    try {
        var compName = args.compName || "";
        var text = args.text || "Text Layer";
        var position = args.position || [960, 540]; 
        var fontSize = args.fontSize || 72;
        var color = args.color || [1, 1, 1]; 
        var startTime = args.startTime || 0;
        var duration = args.duration || 5; 
        var fontFamily = args.fontFamily || "Arial";
        var alignment = args.alignment || "center"; 
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; } 
            else { throw new Error("No composition found with name '" + compName + "' and no active composition"); }
        }
        var textLayer = comp.layers.addText(text);
        var textProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document");
        var textDocument = textProp.value;
        textDocument.fontSize = fontSize;
        textDocument.fillColor = color;
        textDocument.font = fontFamily;
        if (alignment === "left") { textDocument.justification = ParagraphJustification.LEFT_JUSTIFY; } 
        else if (alignment === "center") { textDocument.justification = ParagraphJustification.CENTER_JUSTIFY; } 
        else if (alignment === "right") { textDocument.justification = ParagraphJustification.RIGHT_JUSTIFY; }
        textProp.setValue(textDocument);
        textLayer.property("Position").setValue(position);
        textLayer.startTime = startTime;
        if (duration > 0) { textLayer.outPoint = startTime + duration; }
        return JSON.stringify({
            status: "success", message: "Text layer created successfully",
            layer: { name: textLayer.name, index: textLayer.index, type: "text", inPoint: textLayer.inPoint, outPoint: textLayer.outPoint, position: textLayer.property("Position").value }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- createShapeLayer (from createShapeLayer.jsx) --- 
function createShapeLayer(args) {
    try {
        var compName = args.compName || "";
        var shapeType = args.shapeType || "rectangle"; 
        var position = args.position || [960, 540]; 
        var size = args.size || [200, 200]; 
        var fillColor = args.fillColor || [1, 0, 0]; 
        var strokeColor = args.strokeColor || [0, 0, 0]; 
        var strokeWidth = args.strokeWidth || 0; 
        var startTime = args.startTime || 0;
        var duration = args.duration || 5; 
        var name = args.name || "Shape Layer";
        var points = args.points || 5; 
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; } 
            else { throw new Error("No composition found with name '" + compName + "' and no active composition"); }
        }
        var shapeLayer = comp.layers.addShape();
        shapeLayer.name = name;
        var contents = shapeLayer.property("Contents"); 
        var shapeGroup = contents.addProperty("ADBE Vector Group");
        var groupContents = shapeGroup.property("Contents"); 
        var shapePathProperty;
        if (shapeType === "rectangle") {
            shapePathProperty = groupContents.addProperty("ADBE Vector Shape - Rect");
            shapePathProperty.property("Size").setValue(size);
        } else if (shapeType === "ellipse") {
            shapePathProperty = groupContents.addProperty("ADBE Vector Shape - Ellipse");
            shapePathProperty.property("Size").setValue(size);
        } else if (shapeType === "polygon" || shapeType === "star") { 
            shapePathProperty = groupContents.addProperty("ADBE Vector Shape - Star");
            shapePathProperty.property("Type").setValue(shapeType === "polygon" ? 1 : 2); 
            shapePathProperty.property("Points").setValue(points);
            shapePathProperty.property("Outer Radius").setValue(size[0] / 2);
            if (shapeType === "star") { shapePathProperty.property("Inner Radius").setValue(size[0] / 3); }
        }
        var fill = groupContents.addProperty("ADBE Vector Graphic - Fill");
        fill.property("Color").setValue(fillColor);
        fill.property("Opacity").setValue(100);
        if (strokeWidth > 0) {
            var stroke = groupContents.addProperty("ADBE Vector Graphic - Stroke");
            stroke.property("Color").setValue(strokeColor);
            stroke.property("Stroke Width").setValue(strokeWidth);
            stroke.property("Opacity").setValue(100);
        }
        shapeLayer.property("Position").setValue(position);
        shapeLayer.startTime = startTime;
        if (duration > 0) { shapeLayer.outPoint = startTime + duration; }
        return JSON.stringify({
            status: "success", message: "Shape layer created successfully",
            layer: { name: shapeLayer.name, index: shapeLayer.index, type: "shape", shapeType: shapeType, inPoint: shapeLayer.inPoint, outPoint: shapeLayer.outPoint, position: shapeLayer.property("Position").value }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- createSolidLayer (from createSolidLayer.jsx) --- 
function createSolidLayer(args) {
    try {
        var compName = args.compName || "";
        var color = args.color || [1, 1, 1]; 
        var name = args.name || "Solid Layer";
        var position = args.position || [960, 540]; 
        var size = args.size; 
        var startTime = args.startTime || 0;
        var duration = args.duration || 5; 
        var isAdjustment = args.isAdjustment || false; 
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; } 
            else { throw new Error("No composition found with name '" + compName + "' and no active composition"); }
        }
        if (!size) { size = [comp.width, comp.height]; }
        var solidLayer;
        if (isAdjustment) {
            solidLayer = comp.layers.addSolid([0, 0, 0], name, size[0], size[1], 1);
            solidLayer.adjustmentLayer = true;
        } else {
            solidLayer = comp.layers.addSolid(color, name, size[0], size[1], 1);
        }
        solidLayer.property("Position").setValue(position);
        solidLayer.startTime = startTime;
        if (duration > 0) { solidLayer.outPoint = startTime + duration; }
        return JSON.stringify({
            status: "success", message: isAdjustment ? "Adjustment layer created successfully" : "Solid layer created successfully",
            layer: { name: solidLayer.name, index: solidLayer.index, type: isAdjustment ? "adjustment" : "solid", inPoint: solidLayer.inPoint, outPoint: solidLayer.outPoint, position: solidLayer.property("Position").value, isAdjustment: solidLayer.adjustmentLayer }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- setLayerProperties (modified to handle text properties) ---
function setLayerProperties(args) {
    try {
        var compName = args.compName || "";
        var layerName = args.layerName || "";
        var layerIndex = args.layerIndex; 
        
        // General Properties
        var position = args.position; 
        var scale = args.scale; 
        var rotation = args.rotation; 
        var opacity = args.opacity; 
        var startTime = args.startTime; 
        var duration = args.duration; 

        // Text Specific Properties
        var textContent = args.text; // New: text content
        var fontFamily = args.fontFamily; // New: font family
        var fontSize = args.fontSize; // New: font size
        var fillColor = args.fillColor; // New: font color
        
        // Find the composition (same logic as before)
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; } 
            else { throw new Error("No composition found with name '" + compName + "' and no active composition"); }
        }
        
        // Find the layer (same logic as before)
        var layer = null;
        if (layerIndex !== undefined && layerIndex !== null) {
            if (layerIndex > 0 && layerIndex <= comp.numLayers) { layer = comp.layer(layerIndex); } 
            else { throw new Error("Layer index out of bounds: " + layerIndex); }
        } else if (layerName) {
            for (var j = 1; j <= comp.numLayers; j++) {
                if (comp.layer(j).name === layerName) { layer = comp.layer(j); break; }
            }
        }
        if (!layer) { throw new Error("Layer not found: " + (layerName || "index " + layerIndex)); }
        
        var changedProperties = [];
        var textDocumentChanged = false;
        var textProp = null;
        var textDocument = null;

        // --- Text Property Handling ---
        if (layer instanceof TextLayer && (textContent !== undefined || fontFamily !== undefined || fontSize !== undefined || fillColor !== undefined)) {
            var sourceTextProp = layer.property("Source Text");
            if (sourceTextProp && sourceTextProp.value) {
                var currentTextDocument = sourceTextProp.value; // Get the current value
                var updated = false;

                if (textContent !== undefined && textContent !== null && currentTextDocument.text !== textContent) {
                    currentTextDocument.text = textContent;
                    changedProperties.push("text");
                    updated = true;
                }
                if (fontFamily !== undefined && fontFamily !== null && currentTextDocument.font !== fontFamily) {
                    // Add basic validation/logging for font existence if needed
                    // try { app.fonts.findFont(fontFamily); } catch (e) { logToPanel("Warning: Font '"+fontFamily+"' might not be installed."); }
                    currentTextDocument.font = fontFamily;
                    changedProperties.push("fontFamily");
                    updated = true;
                }
                if (fontSize !== undefined && fontSize !== null && currentTextDocument.fontSize !== fontSize) {
                    currentTextDocument.fontSize = fontSize;
                    changedProperties.push("fontSize");
                    updated = true;
                }
                // Comparing colors needs care due to potential floating point inaccuracies if set via UI
                // Simple comparison for now
                if (fillColor !== undefined && fillColor !== null && 
                    (currentTextDocument.fillColor[0] !== fillColor[0] || 
                     currentTextDocument.fillColor[1] !== fillColor[1] || 
                     currentTextDocument.fillColor[2] !== fillColor[2])) {
                    currentTextDocument.fillColor = fillColor;
                    changedProperties.push("fillColor");
                    updated = true;
                }

                // Only set the value if something actually changed
                if (updated) {
                    try {
                        sourceTextProp.setValue(currentTextDocument);
                        logToPanel("Applied changes to Text Document for layer: " + layer.name);
                    } catch (e) {
                        logToPanel("ERROR applying Text Document changes: " + e.toString());
                        // Decide if we should throw or just log the error for text properties
                        // For now, just log, other properties might still succeed
                    }
                }
                 // Store the potentially updated document for the return value
                 textDocument = currentTextDocument; 

            } else {
                logToPanel("Warning: Could not access Source Text property for layer: " + layer.name);
            }
        }

        // --- General Property Handling ---
        if (position !== undefined && position !== null) { layer.property("Position").setValue(position); changedProperties.push("position"); }
        if (scale !== undefined && scale !== null) { layer.property("Scale").setValue(scale); changedProperties.push("scale"); }
        if (rotation !== undefined && rotation !== null) {
            if (layer.threeDLayer) { 
                // For 3D layers, Z rotation is often what's intended by a single value
                layer.property("Z Rotation").setValue(rotation);
            } else { 
                layer.property("Rotation").setValue(rotation); 
            }
            changedProperties.push("rotation");
        }
        if (opacity !== undefined && opacity !== null) { layer.property("Opacity").setValue(opacity); changedProperties.push("opacity"); }
        if (startTime !== undefined && startTime !== null) { layer.startTime = startTime; changedProperties.push("startTime"); }
        if (duration !== undefined && duration !== null && duration > 0) {
            var actualStartTime = (startTime !== undefined && startTime !== null) ? startTime : layer.startTime;
            layer.outPoint = actualStartTime + duration;
            changedProperties.push("duration");
        }

        // Return success with updated layer details (including text if changed)
        var returnLayerInfo = {
            name: layer.name,
            index: layer.index,
            position: layer.property("Position").value,
            scale: layer.property("Scale").value,
            rotation: layer.threeDLayer ? layer.property("Z Rotation").value : layer.property("Rotation").value, // Return appropriate rotation
            opacity: layer.property("Opacity").value,
            inPoint: layer.inPoint,
            outPoint: layer.outPoint,
            changedProperties: changedProperties
        };
        // Add text properties to the return object if it was a text layer
        if (layer instanceof TextLayer && textDocument) {
            returnLayerInfo.text = textDocument.text;
            returnLayerInfo.fontFamily = textDocument.font;
            returnLayerInfo.fontSize = textDocument.fontSize;
            returnLayerInfo.fillColor = textDocument.fillColor;
        }

        // *** ADDED LOGGING HERE ***
        logToPanel("Final check before return:");
        logToPanel("  Changed Properties: " + changedProperties.join(", "));
        logToPanel("  Return Layer Info Font: " + (returnLayerInfo.fontFamily || "N/A")); 
        logToPanel("  TextDocument Font: " + (textDocument ? textDocument.font : "N/A"));

        return JSON.stringify({
            status: "success", message: "Layer properties updated successfully",
            layer: returnLayerInfo
        }, null, 2);
    } catch (error) {
        // Error handling remains similar, but add more specific checks if needed
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

/**
 * Sets a keyframe for a specific property on a layer.
 * Indices are 1-based for After Effects collections.
 * @param {number} compIndex - The index of the composition (1-based).
 * @param {number} layerIndex - The index of the layer within the composition (1-based).
 * @param {string} propertyName - The name of the property (e.g., "Position", "Scale", "Rotation", "Opacity").
 * @param {number} timeInSeconds - The time (in seconds) for the keyframe.
 * @param {any} value - The value for the keyframe (e.g., [x, y] for Position, [w, h] for Scale, angle for Rotation, percentage for Opacity).
 * @returns {string} JSON string indicating success or error.
 */
function setLayerKeyframe(compIndex, layerIndex, propertyName, timeInSeconds, value) {
    try {
        // Use 1-based indices as per After Effects API
        var comp = app.project.items[compIndex];
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, message: "Composition not found at index " + compIndex });
        }
        var layer = comp.layers[layerIndex];
        if (!layer) {
            return JSON.stringify({ success: false, message: "Layer not found at index " + layerIndex + " in composition '" + comp.name + "'"});
        }

        var transformGroup = layer.property("Transform");
        if (!transformGroup) {
             return JSON.stringify({ success: false, message: "Transform properties not found for layer '" + layer.name + "' (type: " + layer.matchName + ")." });
        }

        var property = transformGroup.property(propertyName);
        if (!property) {
            // Check other common property groups if not in Transform
             if (layer.property("Effects") && layer.property("Effects").property(propertyName)) {
                 property = layer.property("Effects").property(propertyName);
             } else if (layer.property("Text") && layer.property("Text").property(propertyName)) {
                 property = layer.property("Text").property(propertyName);
            } // Add more groups if needed (e.g., Masks, Shapes)

            if (!property) {
                 return JSON.stringify({ success: false, message: "Property '" + propertyName + "' not found on layer '" + layer.name + "'." });
            }
        }


        // Ensure the property can be keyframed
        if (!property.canVaryOverTime) {
             return JSON.stringify({ success: false, message: "Property '" + propertyName + "' cannot be keyframed." });
        }

        // Make sure the property is enabled for keyframing
        if (property.numKeys === 0 && !property.isTimeVarying) {
             property.setValueAtTime(comp.time, property.value); // Set initial keyframe if none exist
        }


        property.setValueAtTime(timeInSeconds, value);

        return JSON.stringify({ success: true, message: "Keyframe set for '" + propertyName + "' on layer '" + layer.name + "' at " + timeInSeconds + "s." });
    } catch (e) {
        return JSON.stringify({ success: false, message: "Error setting keyframe: " + e.toString() + " (Line: " + e.line + ")" });
    }
}


/**
 * Sets an expression for a specific property on a layer.
 * @param {number} compIndex - The index of the composition (1-based).
 * @param {number} layerIndex - The index of the layer within the composition (1-based).
 * @param {string} propertyName - The name of the property (e.g., "Position", "Scale", "Rotation", "Opacity").
 * @param {string} expressionString - The JavaScript expression string. Use "" to remove expression.
 * @returns {string} JSON string indicating success or error.
 */
function setLayerExpression(compIndex, layerIndex, propertyName, expressionString) {
    try {
         // Adjust indices to be 0-based for ExtendScript arrays
        var comp = app.project.items[compIndex];
         if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, message: "Composition not found at index " + compIndex });
        }
        var layer = comp.layers[layerIndex];
         if (!layer) {
            return JSON.stringify({ success: false, message: "Layer not found at index " + layerIndex + " in composition '" + comp.name + "'"});
        }

        var transformGroup = layer.property("Transform");
         if (!transformGroup) {
             // Allow expressions on non-transformable layers if property exists elsewhere
             // return JSON.stringify({ success: false, message: "Transform properties not found for layer '" + layer.name + "' (type: " + layer.matchName + ")." });
        }

        var property = transformGroup ? transformGroup.property(propertyName) : null;
         if (!property) {
            // Check other common property groups if not in Transform
             if (layer.property("Effects") && layer.property("Effects").property(propertyName)) {
                 property = layer.property("Effects").property(propertyName);
             } else if (layer.property("Text") && layer.property("Text").property(propertyName)) {
                 property = layer.property("Text").property(propertyName);
             } // Add more groups if needed

            if (!property) {
                 return JSON.stringify({ success: false, message: "Property '" + propertyName + "' not found on layer '" + layer.name + "'." });
            }
        }

        if (!property.canSetExpression) {
            return JSON.stringify({ success: false, message: "Property '" + propertyName + "' does not support expressions." });
        }

        property.expression = expressionString;

        var action = expressionString === "" ? "removed" : "set";
        return JSON.stringify({ success: true, message: "Expression " + action + " for '" + propertyName + "' on layer '" + layer.name + "'." });
    } catch (e) {
        return JSON.stringify({ success: false, message: "Error setting expression: " + e.toString() + " (Line: " + e.line + ")" });
    }
}

// --- applyEffect (from applyEffect.jsx) ---
function applyEffect(args) {
    try {
        // Extract parameters
        var compIndex = args.compIndex || 1; // Default to first comp
        var layerIndex = args.layerIndex || 1; // Default to first layer
        var effectName = args.effectName; // Name of the effect to apply
        var effectMatchName = args.effectMatchName; // After Effects internal name (more reliable)
        var effectCategory = args.effectCategory || ""; // Optional category for filtering
        var presetPath = args.presetPath; // Optional path to an effect preset
        var effectSettings = args.effectSettings || {}; // Optional effect parameters
        
        if (!effectName && !effectMatchName && !presetPath) {
            throw new Error("You must specify either effectName, effectMatchName, or presetPath");
        }
        
        // Find the composition by index
        var comp = app.project.item(compIndex);
        if (!comp || !(comp instanceof CompItem)) {
            throw new Error("Composition not found at index " + compIndex);
        }
        
        // Find the layer by index
        var layer = comp.layer(layerIndex);
        if (!layer) {
            throw new Error("Layer not found at index " + layerIndex + " in composition '" + comp.name + "'");
        }
        
        var effectResult;
        
        // Apply preset if a path is provided
        if (presetPath) {
            var presetFile = new File(presetPath);
            if (!presetFile.exists) {
                throw new Error("Effect preset file not found: " + presetPath);
            }
            
            // Apply the preset to the layer
            layer.applyPreset(presetFile);
            effectResult = {
                type: "preset",
                name: presetPath.split('/').pop().split('\\').pop(),
                applied: true
            };
        }
        // Apply effect by match name (more reliable method)
        else if (effectMatchName) {
            var effect = layer.Effects.addProperty(effectMatchName);
            effectResult = {
                type: "effect",
                name: effect.name,
                matchName: effect.matchName,
                index: effect.propertyIndex
            };
            
            // Apply settings if provided
            applyEffectSettings(effect, effectSettings);
        }
        // Apply effect by display name
        else {
            // Get the effect from the Effect menu
            var effect = layer.Effects.addProperty(effectName);
            effectResult = {
                type: "effect",
                name: effect.name,
                matchName: effect.matchName,
                index: effect.propertyIndex
            };
            
            // Apply settings if provided
            applyEffectSettings(effect, effectSettings);
        }
        
        return JSON.stringify({
            status: "success",
            message: "Effect applied successfully",
            effect: effectResult,
            layer: {
                name: layer.name,
                index: layerIndex
            },
            composition: {
                name: comp.name,
                index: compIndex
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    }
}

// Helper function to apply effect settings
function applyEffectSettings(effect, settings) {
    // Skip if no settings are provided
    if (!settings || Object.keys(settings).length === 0) {
        return;
    }
    
    // Iterate through all provided settings
    for (var propName in settings) {
        if (settings.hasOwnProperty(propName)) {
            try {
                // Find the property in the effect
                var property = null;
                
                // Try direct property access first
                try {
                    property = effect.property(propName);
                } catch (e) {
                    // If direct access fails, search through all properties
                    for (var i = 1; i <= effect.numProperties; i++) {
                        var prop = effect.property(i);
                        if (prop.name === propName) {
                            property = prop;
                            break;
                        }
                    }
                }
                
                // Set the property value if found
                if (property && property.setValue) {
                    property.setValue(settings[propName]);
                }
            } catch (e) {
                // Log error but continue with other properties
                $.writeln("Error setting effect property '" + propName + "': " + e.toString());
            }
        }
    }
}

// --- applyEffectTemplate (from applyEffectTemplate.jsx) ---
function applyEffectTemplate(args) {
    try {
        // Extract parameters
        var compIndex = args.compIndex || 1; // Default to first comp
        var layerIndex = args.layerIndex || 1; // Default to first layer
        var templateName = args.templateName; // Name of the template to apply
        var customSettings = args.customSettings || {}; // Optional customizations
        
        if (!templateName) {
            throw new Error("You must specify a templateName");
        }
        
        // Find the composition by index
        var comp = app.project.item(compIndex);
        if (!comp || !(comp instanceof CompItem)) {
            throw new Error("Composition not found at index " + compIndex);
        }
        
        // Find the layer by index
        var layer = comp.layer(layerIndex);
        if (!layer) {
            throw new Error("Layer not found at index " + layerIndex + " in composition '" + comp.name + "'");
        }
        
        // Template definitions
        var templates = {
            // Blur effects
            "gaussian-blur": {
                effectMatchName: "ADBE Gaussian Blur 2",
                settings: {
                    "Blurriness": customSettings.blurriness || 20
                }
            },
            "directional-blur": {
                effectMatchName: "ADBE Directional Blur",
                settings: {
                    "Direction": customSettings.direction || 0,
                    "Blur Length": customSettings.length || 10
                }
            },
            
            // Color correction effects
            "color-balance": {
                effectMatchName: "ADBE Color Balance (HLS)",
                settings: {
                    "Hue": customSettings.hue || 0,
                    "Lightness": customSettings.lightness || 0,
                    "Saturation": customSettings.saturation || 0
                }
            },
            "brightness-contrast": {
                effectMatchName: "ADBE Brightness & Contrast 2",
                settings: {
                    "Brightness": customSettings.brightness || 0,
                    "Contrast": customSettings.contrast || 0,
                    "Use Legacy": false
                }
            },
            "curves": {
                effectMatchName: "ADBE CurvesCustom",
                // Curves are complex and would need special handling
            },
            
            // Stylistic effects
            "glow": {
                effectMatchName: "ADBE Glow",
                settings: {
                    "Glow Threshold": customSettings.threshold || 50,
                    "Glow Radius": customSettings.radius || 15,
                    "Glow Intensity": customSettings.intensity || 1
                }
            },
            "drop-shadow": {
                effectMatchName: "ADBE Drop Shadow",
                settings: {
                    "Shadow Color": customSettings.color || [0, 0, 0, 1],
                    "Opacity": customSettings.opacity || 50,
                    "Direction": customSettings.direction || 135,
                    "Distance": customSettings.distance || 10,
                    "Softness": customSettings.softness || 10
                }
            },
            
            // Common effect chains
            "cinematic-look": {
                effects: [
                    {
                        effectMatchName: "ADBE CurvesCustom",
                        settings: {}
                    },
                    {
                        effectMatchName: "ADBE Vibrance",
                        settings: {
                            "Vibrance": 15,
                            "Saturation": -5
                        }
                    }
                ]
            },
            "text-pop": {
                effects: [
                    {
                        effectMatchName: "ADBE Drop Shadow",
                        settings: {
                            "Shadow Color": [0, 0, 0, 1],
                            "Opacity": 75,
                            "Distance": 5,
                            "Softness": 10
                        }
                    },
                    {
                        effectMatchName: "ADBE Glow",
                        settings: {
                            "Glow Threshold": 50,
                            "Glow Radius": 10,
                            "Glow Intensity": 1.5
                        }
                    }
                ]
            }
        };
        
        // Check if the requested template exists
        var template = templates[templateName];
        if (!template) {
            var availableTemplates = Object.keys(templates).join(", ");
            throw new Error("Template '" + templateName + "' not found. Available templates: " + availableTemplates);
        }
        
        var appliedEffects = [];
        
        // Apply single effect or multiple effects based on template structure
        if (template.effectMatchName) {
            // Single effect template
            var effect = layer.Effects.addProperty(template.effectMatchName);
            
            // Apply settings
            for (var propName in template.settings) {
                try {
                    var property = effect.property(propName);
                    if (property) {
                        property.setValue(template.settings[propName]);
                    }
                } catch (e) {
                    $.writeln("Warning: Could not set " + propName + " on effect " + effect.name + ": " + e);
                }
            }
            
            appliedEffects.push({
                name: effect.name,
                matchName: effect.matchName
            });
        } else if (template.effects) {
            // Multiple effects template
            for (var i = 0; i < template.effects.length; i++) {
                var effectData = template.effects[i];
                var effect = layer.Effects.addProperty(effectData.effectMatchName);
                
                // Apply settings
                for (var propName in effectData.settings) {
                    try {
                        var property = effect.property(propName);
                        if (property) {
                            property.setValue(effectData.settings[propName]);
                        }
                    } catch (e) {
                        $.writeln("Warning: Could not set " + propName + " on effect " + effect.name + ": " + e);
                    }
                }
                
                appliedEffects.push({
                    name: effect.name,
                    matchName: effect.matchName
                });
            }
        }
        
        return JSON.stringify({
            status: "success",
            message: "Effect template '" + templateName + "' applied successfully",
            appliedEffects: appliedEffects,
            layer: {
                name: layer.name,
                index: layerIndex
            },
            composition: {
                name: comp.name,
                index: compIndex
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    }
}

// --- createTypewriterEffect - Creates a typewriter text effect with cursor ---
function createTypewriterEffect(args) {
    try {
        var compName = args.compName || "";
        var text = args.text || "Hello World";
        var position = args.position || [960, 540];
        var fontSize = parseInt(args.fontSize) || 72;
        var fontFamily = args.fontFamily || "Courier";
        var textColor = args.textColor || [1, 1, 1];
        var cursorChar = args.cursorChar || "|";
        var cursorBlinkSpeed = parseFloat(args.cursorBlinkSpeed) || 2; // blinks per second
        var preTypeDelay = parseFloat(args.preTypeDelay) || 1; // seconds before typing starts
        var typeSpeed = parseFloat(args.typeSpeed) || 10; // characters per second
        var showDuration = parseFloat(args.showDuration) || 2; // seconds to show full text
        var showCursorDuringDisplay = args.showCursorDuringDisplay !== false; // default true
        var backspaceSpeed = parseFloat(args.backspaceSpeed) || 15; // characters per second
        var postDeleteDelay = parseFloat(args.postDeleteDelay) || 0.5; // seconds after delete
        
        // Find the composition
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) {
                comp = item;
                break;
            }
        }
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) {
                comp = app.project.activeItem;
            } else {
                throw new Error("No composition found with name '" + compName + "' and no active composition");
            }
        }
        
        // --- Step 1: Create Controls Null layer ---
        var controlsNull = comp.layers.addNull();
        controlsNull.name = "Typewriter Controls";
        
        // Add slider controls
        var blinkSpeedCtrl = controlsNull.Effects.addProperty("ADBE Slider Control");
        blinkSpeedCtrl.name = "Cursor Blink Speed";
        blinkSpeedCtrl.property("Slider").setValue(cursorBlinkSpeed);
        
        var preDelayCtrl = controlsNull.Effects.addProperty("ADBE Slider Control");
        preDelayCtrl.name = "Pre-Type Delay";
        preDelayCtrl.property("Slider").setValue(preTypeDelay);
        
        var typeSpeedCtrl = controlsNull.Effects.addProperty("ADBE Slider Control");
        typeSpeedCtrl.name = "Type Speed";
        typeSpeedCtrl.property("Slider").setValue(typeSpeed);
        
        var showDurCtrl = controlsNull.Effects.addProperty("ADBE Slider Control");
        showDurCtrl.name = "Show Duration";
        showDurCtrl.property("Slider").setValue(showDuration);
        
        var showCursorCtrl = controlsNull.Effects.addProperty("ADBE Checkbox Control");
        showCursorCtrl.name = "Show Cursor During Display";
        showCursorCtrl.property("Checkbox").setValue(showCursorDuringDisplay ? 1 : 0);
        
        var backspaceSpeedCtrl = controlsNull.Effects.addProperty("ADBE Slider Control");
        backspaceSpeedCtrl.name = "Backspace Speed";
        backspaceSpeedCtrl.property("Slider").setValue(backspaceSpeed);
        
        var postDelayCtrl = controlsNull.Effects.addProperty("ADBE Slider Control");
        postDelayCtrl.name = "Post-Delete Delay";
        postDelayCtrl.property("Slider").setValue(postDeleteDelay);
        
        var cursorOffsetCtrl = controlsNull.Effects.addProperty("ADBE Slider Control");
        cursorOffsetCtrl.name = "Cursor Offset";
        cursorOffsetCtrl.property("Slider").setValue(args.cursorOffset || 5);
        
        // --- Step 2: Create HIDDEN source text layer (holds the original text) ---
        var sourceTextLayer = comp.layers.addText(text);
        sourceTextLayer.name = "Typewriter Source";
        sourceTextLayer.enabled = false; // Hide it
        
        var sourceProp = sourceTextLayer.property("ADBE Text Properties").property("ADBE Text Document");
        var sourceDoc = sourceProp.value;
        sourceDoc.fontSize = fontSize;
        sourceDoc.font = fontFamily;
        sourceDoc.fillColor = textColor;
        sourceDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
        sourceProp.setValue(sourceDoc);
        
        sourceTextLayer.property("Position").setValue(position);
        
        // --- Step 3: Create the visible text layer (shows partial text) ---
        var textLayer = comp.layers.addText("");
        textLayer.name = "Typewriter Text";
        
        var textProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document");
        var textDoc = textProp.value;
        textDoc.fontSize = fontSize;
        textDoc.font = fontFamily;
        textDoc.fillColor = textColor;
        textDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
        textProp.setValue(textDoc);
        
        textLayer.property("Position").setValue(position);
        
        // Build the typewriter expression - reads from source layer
        var textExpression = '// Typewriter Effect Expression\n';
        textExpression += 'var ctrl = thisComp.layer("Typewriter Controls");\n';
        textExpression += 'var srcLayer = thisComp.layer("Typewriter Source");\n';
        textExpression += 'var fullText = srcLayer.text.sourceText.value.toString();\n';
        textExpression += 'var preDelay = ctrl.effect("Pre-Type Delay")("Slider");\n';
        textExpression += 'var typeSpd = ctrl.effect("Type Speed")("Slider");\n';
        textExpression += 'var showDur = ctrl.effect("Show Duration")("Slider");\n';
        textExpression += 'var backSpd = ctrl.effect("Backspace Speed")("Slider");\n';
        textExpression += 'var postDelay = ctrl.effect("Post-Delete Delay")("Slider");\n\n';
        textExpression += 'var textLen = fullText.length;\n';
        textExpression += 'var typeDuration = textLen / Math.max(typeSpd, 0.1);\n';
        textExpression += 'var backspaceDuration = textLen / Math.max(backSpd, 0.1);\n\n';
        textExpression += '// Timeline phases\n';
        textExpression += 'var phase1End = preDelay;\n';
        textExpression += 'var phase2End = phase1End + typeDuration;\n';
        textExpression += 'var phase3End = phase2End + showDur;\n';
        textExpression += 'var phase4End = phase3End + backspaceDuration;\n\n';
        textExpression += 'var t = time;\n';
        textExpression += 'var charsToShow = 0;\n\n';
        textExpression += 'if (t < phase1End) {\n';
        textExpression += '    charsToShow = 0;\n';
        textExpression += '} else if (t < phase2End) {\n';
        textExpression += '    var typeProgress = (t - phase1End) / typeDuration;\n';
        textExpression += '    charsToShow = Math.floor(typeProgress * textLen);\n';
        textExpression += '} else if (t < phase3End) {\n';
        textExpression += '    charsToShow = textLen;\n';
        textExpression += '} else if (t < phase4End) {\n';
        textExpression += '    var backProgress = (t - phase3End) / backspaceDuration;\n';
        textExpression += '    charsToShow = Math.floor((1 - backProgress) * textLen);\n';
        textExpression += '} else {\n';
        textExpression += '    charsToShow = 0;\n';
        textExpression += '}\n\n';
        textExpression += 'fullText.substring(0, Math.max(0, charsToShow));';
        
        textLayer.property("Source Text").expression = textExpression;
        
        // --- Step 4: Create the cursor layer ---
        var cursorLayer = comp.layers.addText(cursorChar);
        cursorLayer.name = "Typewriter Cursor";
        
        var cursorProp = cursorLayer.property("ADBE Text Properties").property("ADBE Text Document");
        var cursorDoc = cursorProp.value;
        cursorDoc.fontSize = fontSize;
        cursorDoc.font = fontFamily;
        cursorDoc.fillColor = textColor;
        cursorDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
        cursorProp.setValue(cursorDoc);
        
        // Position cursor at base position initially
        cursorLayer.property("Position").setValue(position);
        
        // Position the cursor: smooth during typing/backspace, with offset during full display
        var cursorPosExpression = '// Cursor with smooth movement and offset during display\n';
        cursorPosExpression += 'var ctrl = thisComp.layer("Typewriter Controls");\n';
        cursorPosExpression += 'var srcLayer = thisComp.layer("Typewriter Source");\n';
        cursorPosExpression += 'var textLayer = thisComp.layer("Typewriter Text");\n';
        cursorPosExpression += 'var basePos = textLayer.position.value;\n\n';
        cursorPosExpression += '// Get timing parameters\n';
        cursorPosExpression += 'var fullText = srcLayer.text.sourceText.value.toString();\n';
        cursorPosExpression += 'var textLen = fullText.length;\n';
        cursorPosExpression += 'var preDelay = ctrl.effect("Pre-Type Delay")("Slider");\n';
        cursorPosExpression += 'var typeSpd = ctrl.effect("Type Speed")("Slider");\n';
        cursorPosExpression += 'var showDur = ctrl.effect("Show Duration")("Slider");\n';
        cursorPosExpression += 'var backSpd = ctrl.effect("Backspace Speed")("Slider");\n';
        cursorPosExpression += 'var cursorOffset = ctrl.effect("Cursor Offset")("Slider");\n\n';
        cursorPosExpression += 'var typeDuration = textLen / Math.max(typeSpd, 0.1);\n';
        cursorPosExpression += 'var backspaceDuration = textLen / Math.max(backSpd, 0.1);\n\n';
        cursorPosExpression += 'var phase1End = preDelay;\n';
        cursorPosExpression += 'var phase2End = phase1End + typeDuration;\n';
        cursorPosExpression += 'var phase3End = phase2End + showDur;\n';
        cursorPosExpression += 'var phase4End = phase3End + backspaceDuration;\n\n';
        cursorPosExpression += '// Get full text dimensions for smooth interpolation\n';
        cursorPosExpression += 'var srcRect = srcLayer.sourceRectAtTime(0, false);\n';
        cursorPosExpression += 'var fullWidth = srcRect ? srcRect.width : 0;\n';
        cursorPosExpression += 'var xOffset = srcRect ? srcRect.left : 0;\n\n';
        cursorPosExpression += 'var t = time;\n';
        cursorPosExpression += 'var cursorX = 0;\n\n';
        cursorPosExpression += 'if (t < phase1End) {\n';
        cursorPosExpression += '    // Phase 1: Pre-type - cursor at start\n';
        cursorPosExpression += '    cursorX = 0;\n';
        cursorPosExpression += '} else if (t < phase2End) {\n';
        cursorPosExpression += '    // Phase 2: Typing - smooth linear progress\n';
        cursorPosExpression += '    var progress = (t - phase1End) / typeDuration;\n';
        cursorPosExpression += '    cursorX = progress * fullWidth;\n';
        cursorPosExpression += '} else if (t < phase3End) {\n';
        cursorPosExpression += '    // Phase 3: Full display - at end with offset\n';
        cursorPosExpression += '    cursorX = fullWidth + cursorOffset;\n';
        cursorPosExpression += '} else if (t < phase4End) {\n';
        cursorPosExpression += '    // Phase 4: Backspacing - smooth linear reverse\n';
        cursorPosExpression += '    var progress = 1 - ((t - phase3End) / backspaceDuration);\n';
        cursorPosExpression += '    cursorX = progress * fullWidth;\n';
        cursorPosExpression += '} else {\n';
        cursorPosExpression += '    // Phase 5: Post-delete - cursor at start\n';
        cursorPosExpression += '    cursorX = 0;\n';
        cursorPosExpression += '}\n\n';
        cursorPosExpression += '[basePos[0] + xOffset + cursorX, basePos[1]];';
        
        cursorLayer.property("Position").expression = cursorPosExpression;
        
        // Cursor blink expression (opacity)
        var cursorBlinkExpression = '// Cursor blink and visibility\n';
        cursorBlinkExpression += 'var ctrl = thisComp.layer("Typewriter Controls");\n';
        cursorBlinkExpression += 'var srcLayer = thisComp.layer("Typewriter Source");\n';
        cursorBlinkExpression += 'var blinkSpeed = ctrl.effect("Cursor Blink Speed")("Slider");\n';
        cursorBlinkExpression += 'var preDelay = ctrl.effect("Pre-Type Delay")("Slider");\n';
        cursorBlinkExpression += 'var typeSpd = ctrl.effect("Type Speed")("Slider");\n';
        cursorBlinkExpression += 'var showDur = ctrl.effect("Show Duration")("Slider");\n';
        cursorBlinkExpression += 'var backSpd = ctrl.effect("Backspace Speed")("Slider");\n';
        cursorBlinkExpression += 'var postDelay = ctrl.effect("Post-Delete Delay")("Slider");\n';
        cursorBlinkExpression += 'var showCursorDuring = ctrl.effect("Show Cursor During Display")("Checkbox");\n\n';
        cursorBlinkExpression += 'var fullText = srcLayer.text.sourceText.value.toString();\n';
        cursorBlinkExpression += 'var textLen = fullText.length;\n';
        cursorBlinkExpression += 'var typeDuration = textLen / Math.max(typeSpd, 0.1);\n';
        cursorBlinkExpression += 'var backspaceDuration = textLen / Math.max(backSpd, 0.1);\n\n';
        cursorBlinkExpression += 'var phase1End = preDelay;\n';
        cursorBlinkExpression += 'var phase2End = phase1End + typeDuration;\n';
        cursorBlinkExpression += 'var phase3End = phase2End + showDur;\n';
        cursorBlinkExpression += 'var phase4End = phase3End + backspaceDuration;\n';
        cursorBlinkExpression += 'var phase5End = phase4End + postDelay;\n\n';
        cursorBlinkExpression += 'var t = time;\n';
        cursorBlinkExpression += 'var visible = 0;\n\n';
        cursorBlinkExpression += 'if (t < phase1End) {\n';
        cursorBlinkExpression += '    visible = (Math.sin(t * blinkSpeed * Math.PI * 2) > 0) ? 100 : 0;\n';
        cursorBlinkExpression += '} else if (t < phase2End) {\n';
        cursorBlinkExpression += '    visible = 100;\n';
        cursorBlinkExpression += '} else if (t < phase3End) {\n';
        cursorBlinkExpression += '    // Phase 3: Show duration - check if cursor should be visible\n';
        cursorBlinkExpression += '    if (showCursorDuring == 1) {\n';
        cursorBlinkExpression += '        visible = (Math.sin(t * blinkSpeed * Math.PI * 2) > 0) ? 100 : 0;\n';
        cursorBlinkExpression += '    } else {\n';
        cursorBlinkExpression += '        visible = 0;\n';
        cursorBlinkExpression += '    }\n';
        cursorBlinkExpression += '} else if (t < phase4End) {\n';
        cursorBlinkExpression += '    visible = 100;\n';
        cursorBlinkExpression += '} else if (t < phase5End) {\n';
        cursorBlinkExpression += '    visible = (Math.sin(t * blinkSpeed * Math.PI * 2) > 0) ? 100 : 0;\n';
        cursorBlinkExpression += '} else {\n';
        cursorBlinkExpression += '    visible = 0;\n';
        cursorBlinkExpression += '}\n\n';
        cursorBlinkExpression += 'visible;';
        
        cursorLayer.property("Opacity").expression = cursorBlinkExpression;
        
        return JSON.stringify({
            status: "success",
            message: "Typewriter effect created successfully",
            typewriter: {
                composition: comp.name,
                text: text,
                controlsLayer: controlsNull.name,
                sourceLayer: sourceTextLayer.name,
                textLayer: textLayer.name,
                cursorLayer: cursorLayer.name
            },
            controls: [
                "Cursor Blink Speed - blinks per second",
                "Pre-Type Delay - seconds before typing starts",
                "Type Speed - characters per second",
                "Show Duration - seconds to display full text",
                "Show Cursor During Display - checkbox",
                "Backspace Speed - characters per second",
                "Post-Delete Delay - seconds after backspace completes"
            ],
            instructions: "To change the text: Edit the 'Typewriter Source' layer's Source Text.\nTo export to Premiere Pro:\n1. Enable 'Typewriter Source' layer visibility temporarily\n2. Drag its Source Text to Essential Graphics for editable text\n3. Drag slider/checkbox controls from 'Typewriter Controls'\n4. Export as Motion Graphics Template"
        }, null, 2);
        
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- createDiamondPlot - Creates a radar/diamond chart with controllable metrics ---
function createDiamondPlot(args) {
    try {
        var compName = args.compName || "";
        var numPoints = parseInt(args.numPoints) || 3;
        var metricNames = args.metricNames || [];
        var metricValues = args.metricValues || [];
        var maxValue = parseFloat(args.maxValue) || 100;
        var radius = parseFloat(args.radius) || 200;
        var centerX = parseFloat(args.centerX) || 960;
        var centerY = parseFloat(args.centerY) || 540;
        var fillColor = args.fillColor || [0.2, 0.6, 1]; // Light blue
        var strokeColor = args.strokeColor || [0.4, 0.8, 1]; // Lighter blue
        var strokeWidth = parseFloat(args.strokeWidth) || 3;
        var fillOpacity = parseFloat(args.fillOpacity) || 50;
        var showLabels = args.showLabels !== false; // Default true
        var showValues = args.showValues !== false; // Default true
        var labelFontSize = parseInt(args.labelFontSize) || 24;
        var valueFontSize = parseInt(args.valueFontSize) || 18;
        
        // Fill in default metric names if not provided
        for (var i = 0; i < numPoints; i++) {
            if (!metricNames[i]) {
                metricNames[i] = "Metric " + (i + 1);
            }
            if (metricValues[i] === undefined) {
                metricValues[i] = 50; // Default 50%
            }
        }
        
        // Find the composition
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) {
                comp = item;
                break;
            }
        }
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) {
                comp = app.project.activeItem;
            } else {
                throw new Error("No composition found with name '" + compName + "' and no active composition");
            }
        }
        
        // --- Step 1: Create Controls Null layer with Slider Controls ---
        var controlsNull = comp.layers.addNull();
        controlsNull.name = "Diamond Plot Controls";
        controlsNull.property("Position").setValue([centerX, centerY]);
        
        // Add effect controls for each metric
        var sliderEffects = [];
        for (var i = 0; i < numPoints; i++) {
            var sliderEffect = controlsNull.Effects.addProperty("ADBE Slider Control");
            sliderEffect.name = metricNames[i];
            sliderEffect.property("Slider").setValue(metricValues[i]);
            sliderEffects.push(sliderEffect);
        }
        
        // Add a master scale slider
        var scaleSlider = controlsNull.Effects.addProperty("ADBE Slider Control");
        scaleSlider.name = "Plot Scale";
        scaleSlider.property("Slider").setValue(100);
        
        // Add a max value slider for reference
        var maxSlider = controlsNull.Effects.addProperty("ADBE Slider Control");
        maxSlider.name = "Max Value";
        maxSlider.property("Slider").setValue(maxValue);
        
        // --- Step 2: Create the diamond/radar shape layer ---
        var shapeLayer = comp.layers.addShape();
        shapeLayer.name = "Diamond Plot Shape";
        shapeLayer.moveAfter(controlsNull);
        
        var contents = shapeLayer.property("Contents");
        
        // Add a path group
        var pathGroup = contents.addProperty("ADBE Vector Group");
        pathGroup.name = "Diamond Path";
        var pathContents = pathGroup.property("Contents");
        
        // Add the path
        var pathProp = pathContents.addProperty("ADBE Vector Shape - Group");
        
        // Build the expression for the path
        // This expression creates a polygon where each vertex distance from center
        // is determined by the corresponding slider value
        var pathExpression = 'var ctrl = thisComp.layer("Diamond Plot Controls");\n';
        pathExpression += 'var numPoints = ' + numPoints + ';\n';
        pathExpression += 'var maxVal = ctrl.effect("Max Value")("Slider");\n';
        pathExpression += 'var plotScale = ctrl.effect("Plot Scale")("Slider") / 100;\n';
        pathExpression += 'var baseRadius = ' + radius + ';\n';
        pathExpression += 'var centerOffset = [' + centerX + ', ' + centerY + '];\n\n';
        pathExpression += '// Get metric values\n';
        pathExpression += 'var values = [];\n';
        for (var i = 0; i < numPoints; i++) {
            pathExpression += 'values.push(ctrl.effect("' + metricNames[i] + '")("Slider"));\n';
        }
        pathExpression += '\n// Calculate vertices\n';
        pathExpression += 'var vertices = [];\n';
        pathExpression += 'var inTangents = [];\n';
        pathExpression += 'var outTangents = [];\n';
        pathExpression += 'for (var i = 0; i < numPoints; i++) {\n';
        pathExpression += '    var angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2; // Start from top\n';
        pathExpression += '    var normalizedValue = Math.max(0, Math.min(values[i], maxVal)) / maxVal;\n';
        pathExpression += '    var dist = normalizedValue * baseRadius * plotScale;\n';
        pathExpression += '    var x = Math.cos(angle) * dist;\n';
        pathExpression += '    var y = Math.sin(angle) * dist;\n';
        pathExpression += '    vertices.push([x, y]);\n';
        pathExpression += '    inTangents.push([0, 0]);\n';
        pathExpression += '    outTangents.push([0, 0]);\n';
        pathExpression += '}\n';
        pathExpression += 'createPath(vertices, inTangents, outTangents, true);';
        
        pathProp.property("Path").expression = pathExpression;
        
        // Add fill
        var fill = pathContents.addProperty("ADBE Vector Graphic - Fill");
        fill.property("Color").setValue(fillColor);
        fill.property("Opacity").setValue(fillOpacity);
        
        // Add stroke
        var stroke = pathContents.addProperty("ADBE Vector Graphic - Stroke");
        stroke.property("Color").setValue(strokeColor);
        stroke.property("Stroke Width").setValue(strokeWidth);
        stroke.property("Opacity").setValue(100);
        
        // Position the shape layer at center
        shapeLayer.property("Position").setValue([centerX, centerY]);
        
        // --- Step 3: Create axis lines (optional background grid) ---
        var axisLayer = comp.layers.addShape();
        axisLayer.name = "Diamond Plot Axes";
        axisLayer.moveAfter(shapeLayer);
        
        var axisContents = axisLayer.property("Contents");
        
        // Create axis lines from center to each vertex direction
        for (var i = 0; i < numPoints; i++) {
            var angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
            var endX = Math.cos(angle) * radius;
            var endY = Math.sin(angle) * radius;
            
            var lineGroup = axisContents.addProperty("ADBE Vector Group");
            lineGroup.name = "Axis " + (i + 1);
            var lineContents = lineGroup.property("Contents");
            
            var linePath = lineContents.addProperty("ADBE Vector Shape - Group");
            var lineShape = new Shape();
            lineShape.vertices = [[0, 0], [endX, endY]];
            lineShape.closed = false;
            linePath.property("Path").setValue(lineShape);
            
            var lineStroke = lineContents.addProperty("ADBE Vector Graphic - Stroke");
            lineStroke.property("Color").setValue([0.5, 0.5, 0.5]);
            lineStroke.property("Stroke Width").setValue(1);
            lineStroke.property("Opacity").setValue(40);
        }
        
        axisLayer.property("Position").setValue([centerX, centerY]);
        
        // --- Step 4: Create labels if enabled ---
        var labelLayers = [];
        if (showLabels) {
            for (var i = 0; i < numPoints; i++) {
                var angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
                var labelDist = radius + 40; // Place labels outside the chart
                var labelX = centerX + Math.cos(angle) * labelDist;
                var labelY = centerY + Math.sin(angle) * labelDist;
                
                var textLayer = comp.layers.addText(metricNames[i]);
                textLayer.name = "Label: " + metricNames[i];
                
                var textProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document");
                var textDoc = textProp.value;
                textDoc.fontSize = labelFontSize;
                textDoc.fillColor = [1, 1, 1];
                textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                textProp.setValue(textDoc);
                
                textLayer.property("Position").setValue([labelX, labelY]);
                textLayer.property("Anchor Point").setValue([0, 0]);
                
                labelLayers.push(textLayer);
            }
        }
        
        // --- Step 5: Create value displays if enabled ---
        var valueLayers = [];
        if (showValues) {
            for (var i = 0; i < numPoints; i++) {
                var angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
                var valueDist = radius + 70;
                var valueX = centerX + Math.cos(angle) * valueDist;
                var valueY = centerY + Math.sin(angle) * valueDist;
                
                var valueLayer = comp.layers.addText("0");
                valueLayer.name = "Value: " + metricNames[i];
                
                var valueProp = valueLayer.property("ADBE Text Properties").property("ADBE Text Document");
                var valueDoc = valueProp.value;
                valueDoc.fontSize = valueFontSize;
                valueDoc.fillColor = [0.7, 0.7, 0.7];
                valueDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                valueProp.setValue(valueDoc);
                
                valueLayer.property("Position").setValue([valueX, valueY + 25]);
                
                // Add expression to update value text from slider
                var sourceTextProp = valueLayer.property("Source Text");
                var valueExpression = 'var ctrl = thisComp.layer("Diamond Plot Controls");\n';
                valueExpression += 'var val = ctrl.effect("' + metricNames[i] + '")("Slider");\n';
                valueExpression += 'Math.round(val).toString();';
                sourceTextProp.expression = valueExpression;
                
                valueLayers.push(valueLayer);
            }
        }
        
        return JSON.stringify({
            status: "success",
            message: "Diamond plot created successfully with " + numPoints + " points",
            diamondPlot: {
                composition: comp.name,
                numPoints: numPoints,
                metrics: metricNames,
                controlsLayer: controlsNull.name,
                shapeLayer: shapeLayer.name,
                axisLayer: axisLayer.name,
                radius: radius,
                center: [centerX, centerY]
            },
            instructions: "To export to Premiere Pro:\n1. Select the 'Diamond Plot Controls' layer\n2. Open Window > Essential Graphics\n3. Drag the slider effects to the Essential Graphics panel\n4. Click 'Export Motion Graphics Template'\n5. In Premiere Pro, add the .mogrt and adjust sliders in Effect Controls"
        }, null, 2);
        
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- End of Function Definitions ---

// --- Bridge test function to verify communication and effects application ---
function bridgeTestEffects(args) {
    try {
        var compIndex = (args && args.compIndex) ? args.compIndex : 1;
        var layerIndex = (args && args.layerIndex) ? args.layerIndex : 1;

        // Apply a light Gaussian Blur
        var blurRes = JSON.parse(applyEffect({
            compIndex: compIndex,
            layerIndex: layerIndex,
            effectMatchName: "ADBE Gaussian Blur 2",
            effectSettings: { "Blurriness": 5 }
        }));

        // Apply a simple drop shadow via template
        var shadowRes = JSON.parse(applyEffectTemplate({
            compIndex: compIndex,
            layerIndex: layerIndex,
            templateName: "drop-shadow"
        }));

        return JSON.stringify({
            status: "success",
            message: "Bridge test effects applied.",
            results: [blurRes, shadowRes]
        }, null, 2);
    } catch (e) {
        return JSON.stringify({ status: "error", message: e.toString() }, null, 2);
    }
}

// JSON polyfill for ExtendScript (when JSON is undefined)
if (typeof JSON === "undefined") {
    JSON = {};
}
if (typeof JSON.parse !== "function") {
    JSON.parse = function (text) {
        // Safe-ish fallback for trusted input (our own command file)
        return eval("(" + text + ")");
    };
}
if (typeof JSON.stringify !== "function") {
    (function () {
        function esc(str) {
            return (str + "")
                .replace(/\\/g, "\\\\")
                .replace(/"/g, '\\"')
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                .replace(/\t/g, "\\t");
        }
        function toJSON(val) {
            if (val === null) return "null";
            var t = typeof val;
            if (t === "number" || t === "boolean") return String(val);
            if (t === "string") return '"' + esc(val) + '"';
            if (val instanceof Array) {
                var a = [];
                for (var i = 0; i < val.length; i++) a.push(toJSON(val[i]));
                return "[" + a.join(",") + "]";
            }
            if (t === "object") {
                var props = [];
                for (var k in val) {
                    if (val.hasOwnProperty(k) && typeof val[k] !== "function" && typeof val[k] !== "undefined") {
                        props.push('"' + esc(k) + '":' + toJSON(val[k]));
                    }
                }
                return "{" + props.join(",") + "}";
            }
            return "null";
        }
        JSON.stringify = function (value, _replacer, _space) {
            return toJSON(value);
        };
    })();
}

// Check After Effects version (AE 2025 = version 25.x)
var aeVersion = parseFloat(app.version);
var isAE2025OrLater = aeVersion >= 25.0;

// Always create a floating palette window for AE 2025+
var panel = new Window("palette", "MCP Bridge Auto", undefined);
panel.orientation = "column";
panel.alignChildren = ["fill", "top"];
panel.spacing = 10;
panel.margins = 16;

// Status display
var statusText = panel.add("statictext", undefined, "Waiting for commands...");
statusText.alignment = ["fill", "top"];

// Add log area
var logPanel = panel.add("panel", undefined, "Command Log");
logPanel.orientation = "column";
logPanel.alignChildren = ["fill", "fill"];
var logText = logPanel.add("edittext", undefined, "", {multiline: true, readonly: true});
logText.preferredSize.height = 200;

// AE 2025 warning
if (isAE2025OrLater) {
    var warning = panel.add("statictext", undefined, "AE 2025+: Dockable panels are not supported. Floating window only.");
    warning.graphics.foregroundColor = warning.graphics.newPen(warning.graphics.PenType.SOLID_COLOR, [1,0.3,0,1], 1);
}

// Auto-run checkbox
var autoRunCheckbox = panel.add("checkbox", undefined, "Auto-run commands");
autoRunCheckbox.value = true;

// Check interval (ms)
var checkInterval = 2000;
var isChecking = false;

// Command file path - use /tmp on macOS for consistency with Node.js
function getCommandFilePath() {
    // Check if we're on macOS ($.os contains "Macintosh" on Mac)
    if ($.os.indexOf("Macintosh") !== -1 || $.os.indexOf("Mac") !== -1) {
        return "/tmp/ae_command.json";
    }
    // Windows uses Folder.temp
    var tempFolder = Folder.temp;
    return tempFolder.fsName + "/ae_command.json";
}

// Result file path - use /tmp on macOS for consistency with Node.js
function getResultFilePath() {
    // Check if we're on macOS
    if ($.os.indexOf("Macintosh") !== -1 || $.os.indexOf("Mac") !== -1) {
        return "/tmp/ae_mcp_result.json";
    }
    // Windows uses Folder.temp
    var tempFolder = Folder.temp;
    return tempFolder.fsName + "/ae_mcp_result.json";
}

// Functions for each script type
function getProjectInfo() {
    var project = app.project;
    var result = {
        projectName: project.file ? project.file.name : "Untitled Project",
        path: project.file ? project.file.fsName : "",
        numItems: project.numItems,
        bitsPerChannel: project.bitsPerChannel,
        timeMode: project.timeDisplayType === TimeDisplayType.FRAMES ? "Frames" : "Timecode",
        items: []
    };

    // Count item types
    var countByType = {
        compositions: 0,
        footage: 0,
        folders: 0,
        solids: 0
    };

    // Get item information (limited for performance)
    for (var i = 1; i <= Math.min(project.numItems, 50); i++) {
        var item = project.item(i);
        var itemType = "";
        
        if (item instanceof CompItem) {
            itemType = "Composition";
            countByType.compositions++;
        } else if (item instanceof FolderItem) {
            itemType = "Folder";
            countByType.folders++;
        } else if (item instanceof FootageItem) {
            if (item.mainSource instanceof SolidSource) {
                itemType = "Solid";
                countByType.solids++;
            } else {
                itemType = "Footage";
                countByType.footage++;
            }
        }
        
        result.items.push({
            id: item.id,
            name: item.name,
            type: itemType
        });
    }
    
    result.itemCounts = countByType;

    // Include active composition metadata if available
    if (app.project.activeItem instanceof CompItem) {
        var ac = app.project.activeItem;
        result.activeComp = {
            id: ac.id,
            name: ac.name,
            width: ac.width,
            height: ac.height,
            duration: ac.duration,
            frameRate: ac.frameRate,
            numLayers: ac.numLayers
        };
    }

    return JSON.stringify(result, null, 2);
}

function listCompositions() {
    var project = app.project;
    var result = {
        compositions: []
    };
    
    // Loop through items in the project
    for (var i = 1; i <= project.numItems; i++) {
        var item = project.item(i);
        
        // Check if the item is a composition
        if (item instanceof CompItem) {
            result.compositions.push({
                id: item.id,
                name: item.name,
                duration: item.duration,
                frameRate: item.frameRate,
                width: item.width,
                height: item.height,
                numLayers: item.numLayers
            });
        }
    }
    
    return JSON.stringify(result, null, 2);
}

function getLayerInfo() {
    var project = app.project;
    var result = {
        layers: []
    };
    
    // Get the active composition
    var activeComp = null;
    if (app.project.activeItem instanceof CompItem) {
        activeComp = app.project.activeItem;
    } else {
        return JSON.stringify({ error: "No active composition" }, null, 2);
    }
    
    // Loop through layers in the active composition
    for (var i = 1; i <= activeComp.numLayers; i++) {
        var layer = activeComp.layer(i);
        var layerInfo = {
            index: layer.index,
            name: layer.name,
            enabled: layer.enabled,
            locked: layer.locked,
            inPoint: layer.inPoint,
            outPoint: layer.outPoint
        };
        
        result.layers.push(layerInfo);
    }
    
    return JSON.stringify(result, null, 2);
}

// Execute command
function executeCommand(command, args) {
    var result = "";
    
    logToPanel("Executing command: " + command);
    statusText.text = "Running: " + command;
    panel.update();
    
    try {
        logToPanel("Attempting to execute: " + command); // Log before switch
        // Use a switch statement for clarity
        switch (command) {
            case "getProjectInfo":
                result = getProjectInfo();
                break;
            case "listCompositions":
                result = listCompositions();
                break;
            case "getLayerInfo":
                result = getLayerInfo();
                break;
            case "createComposition":
                logToPanel("Calling createComposition function...");
                result = createComposition(args);
                logToPanel("Returned from createComposition.");
                break;
            case "createTextLayer":
                logToPanel("Calling createTextLayer function...");
                result = createTextLayer(args);
                logToPanel("Returned from createTextLayer.");
                break;
            case "createShapeLayer":
                logToPanel("Calling createShapeLayer function...");
                result = createShapeLayer(args);
                logToPanel("Returned from createShapeLayer. Result type: " + typeof result);
                break;
            case "createSolidLayer":
                logToPanel("Calling createSolidLayer function...");
                result = createSolidLayer(args);
                logToPanel("Returned from createSolidLayer.");
                break;
            case "setLayerProperties":
                logToPanel("Calling setLayerProperties function...");
                result = setLayerProperties(args);
                logToPanel("Returned from setLayerProperties.");
                break;
            case "setLayerKeyframe":
                logToPanel("Calling setLayerKeyframe function...");
                result = setLayerKeyframe(args.compIndex, args.layerIndex, args.propertyName, args.timeInSeconds, args.value);
                logToPanel("Returned from setLayerKeyframe.");
                break;
            case "setLayerExpression":
                logToPanel("Calling setLayerExpression function...");
                result = setLayerExpression(args.compIndex, args.layerIndex, args.propertyName, args.expressionString);
                logToPanel("Returned from setLayerExpression.");
                break;
            case "applyEffect":
                logToPanel("Calling applyEffect function...");
                result = applyEffect(args);
                logToPanel("Returned from applyEffect.");
                break;
            case "applyEffectTemplate":
                logToPanel("Calling applyEffectTemplate function...");
                result = applyEffectTemplate(args);
                logToPanel("Returned from applyEffectTemplate.");
                break;
            case "bridgeTestEffects":
                logToPanel("Calling bridgeTestEffects function...");
                result = bridgeTestEffects(args);
                logToPanel("Returned from bridgeTestEffects.");
                break;
            case "createDiamondPlot":
                logToPanel("Calling createDiamondPlot function...");
                result = createDiamondPlot(args);
                logToPanel("Returned from createDiamondPlot.");
                break;
            case "createTypewriterEffect":
                logToPanel("Calling createTypewriterEffect function...");
                result = createTypewriterEffect(args);
                logToPanel("Returned from createTypewriterEffect.");
                break;
            default:
                result = JSON.stringify({ error: "Unknown command: " + command });
        }
        logToPanel("Execution finished for: " + command); // Log after switch
        
        // Save the result (ensure result is always a string)
        logToPanel("Preparing to write result file...");
        var resultString = (typeof result === 'string') ? result : JSON.stringify(result);
        
        // Try to parse the result as JSON to add a timestamp
        try {
            var resultObj = JSON.parse(resultString);
            // Add a timestamp to help identify if we're getting fresh results
            resultObj._responseTimestamp = new Date().toISOString();
            resultObj._commandExecuted = command;
            resultString = JSON.stringify(resultObj, null, 2);
            logToPanel("Added timestamp to result JSON for tracking freshness.");
        } catch (parseError) {
            // If it's not valid JSON, append the timestamp as a comment
            logToPanel("Could not parse result as JSON to add timestamp: " + parseError.toString());
            // We'll still continue with the original string
        }
        
        var resultFile = new File(getResultFilePath());
        resultFile.encoding = "UTF-8"; // Ensure UTF-8 encoding
        logToPanel("Opening result file for writing...");
        var opened = resultFile.open("w");
        if (!opened) {
            logToPanel("ERROR: Failed to open result file for writing: " + resultFile.fsName);
            throw new Error("Failed to open result file for writing.");
        }
        logToPanel("Writing to result file...");
        var written = resultFile.write(resultString);
        if (!written) {
             logToPanel("ERROR: Failed to write to result file (write returned false): " + resultFile.fsName);
             // Still try to close, but log the error
        }
        logToPanel("Closing result file...");
        var closed = resultFile.close();
         if (!closed) {
             logToPanel("ERROR: Failed to close result file: " + resultFile.fsName);
             // Continue, but log the error
        }
        logToPanel("Result file write process complete.");
        
        logToPanel("Command completed successfully: " + command); // Changed log message
        statusText.text = "Command completed: " + command;
        
        // Update command file status
        logToPanel("Updating command status to completed...");
        updateCommandStatus("completed");
        logToPanel("Command status updated.");
        
    } catch (error) {
        var errorMsg = "ERROR in executeCommand for '" + command + "': " + error.toString() + (error.line ? " (line: " + error.line + ")" : "");
        logToPanel(errorMsg); // Log detailed error
        statusText.text = "Error: " + error.toString();
        
        // Write detailed error to result file
        try {
            logToPanel("Attempting to write ERROR to result file...");
            var errorResult = JSON.stringify({ 
                status: "error", 
                command: command,
                message: error.toString(),
                line: error.line,
                fileName: error.fileName
            });
            var errorFile = new File(getResultFilePath());
            errorFile.encoding = "UTF-8";
            if (errorFile.open("w")) {
                errorFile.write(errorResult);
                errorFile.close();
                logToPanel("Successfully wrote ERROR to result file.");
            } else {
                 logToPanel("CRITICAL ERROR: Failed to open result file to write error!");
            }
        } catch (writeError) {
             logToPanel("CRITICAL ERROR: Failed to write error to result file: " + writeError.toString());
        }
        
        // Update command file status even after error
        logToPanel("Updating command status to error...");
        updateCommandStatus("error");
        logToPanel("Command status updated to error.");
    }
}

// Update command file status
function updateCommandStatus(status) {
    try {
        var commandFile = new File(getCommandFilePath());
        if (commandFile.exists) {
            commandFile.open("r");
            var content = commandFile.read();
            commandFile.close();
            
            if (content) {
                var commandData = JSON.parse(content);
                commandData.status = status;
                
                commandFile.open("w");
                commandFile.write(JSON.stringify(commandData, null, 2));
                commandFile.close();
            }
        }
    } catch (e) {
        logToPanel("Error updating command status: " + e.toString());
    }
}

// Log message to panel
function logToPanel(message) {
    var timestamp = new Date().toLocaleTimeString();
    logText.text = timestamp + ": " + message + "\n" + logText.text;
}

// Check for new commands
function checkForCommands() {
    if (!autoRunCheckbox.value || isChecking) return;
    
    isChecking = true;
    
    try {
        var commandFile = new File(getCommandFilePath());
        if (commandFile.exists) {
            commandFile.open("r");
            var content = commandFile.read();
            commandFile.close();
            
            if (content) {
                var commandData = (typeof JSON !== "undefined" && JSON.parse)
                    ? JSON.parse(content)
                    : eval("(" + content + ")");
                
                // Only execute pending commands
                if (commandData.status === "pending") {
                    // Update status to running
                    updateCommandStatus("running");
                    
                    // Execute the command
                    executeCommand(commandData.command, commandData.args || {});
                }
            }
        }
    } catch (e) {
        logToPanel("Error checking for commands: " + e.toString());
    }
    
    isChecking = false;
}

// Set up timer to check for commands
function startCommandChecker() {
    app.scheduleTask("checkForCommands()", checkInterval, true);
}

// Add manual check button
var checkButton = panel.add("button", undefined, "Check for Commands Now");
checkButton.onClick = function() {
    logToPanel("Manually checking for commands");
    checkForCommands();
};

// Log startup
logToPanel("MCP Bridge Auto started");
statusText.text = "Ready - Auto-run is " + (autoRunCheckbox.value ? "ON" : "OFF");

// Start the command checker
startCommandChecker();

// Show the panel
panel.center();
panel.show();
