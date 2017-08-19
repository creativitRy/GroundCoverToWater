// script.name=GroundCoverToWater - ctRy
// script.description=Converts a ground cover layer to water by carving out the ground and increasing the water level\nHover over parameters for more detail
//
// script.param.layer.type=string
// script.param.layer.description=Must be a ground cover layer. Thickness must be negative. Material is ignored. Variation and edge shape will be used to carve out ground.
// script.param.layer.displayName=Layer Name
// script.param.layer.optional=false
//
// script.param.waterOffset.type=integer
// script.param.waterOffset.description=Useful for leaving a bit of air before exposing the water
// script.param.waterOffset.displayName=Water level offset
// script.param.waterOffset.default=-1
// 
// script.param.biome.type=boolean
// script.param.biome.description=Replaces any biome within the ground cover layer except Ocean (not Auto biome Ocean) into River
// script.param.biome.displayName=River Biome
// script.param.biome.default=true
// 
// script.param.delete.type=boolean
// script.param.delete.description=Remove the ground cover layer once the script is finished
// script.param.delete.displayName=Remove Layer
// script.param.delete.default=false
// 
// script.hideCmdLineParams=true

///////////CODE/////////////

if (parseInt(org.pepsoft.worldpainter.Version.BUILD) <= 20160820173357)
    throw "Update WorldPainter!";

print("Script by ctRy");

// https://github.com/Captain-Chaos/WorldPainter/blob/master/WorldPainter/WPCore/src/main/java/org/pepsoft/worldpainter/layers/groundcover/GroundCoverLayerExporter.java
// check to make sure the newly set water level is not less than the previous water level (if it is less, then don't change water level) (and do something about beautifying the carving process in this case)


var layer;
try
{
    layer = wp.getLayer().fromWorld(world).withName(params["layer"]).go();
}
catch(err)
{
    throw "Layer with the name " + params["layer"] + "not found.\n";
}

var thickness;
try
{
    thickness = layer.getThickness();
}
catch(err)
{
    throw "Layer might not be a ground cover layer\n";
}
if (thickness >= 0)
    throw "Ground cover thickness is not negative";
var edgeThickness = Math.abs(thickness) - 2;
var edgeShape = layer.getEdgeShape();
var taperedEdge = (edgeShape != org.pepsoft.worldpainter.layers.groundcover.GroundCoverLayer.EdgeShape.SHEER) && (Math.abs(thickness) > 1);
var edgeWidth = layer.getEdgeWidth();
var edgeFactor = edgeThickness / 2.0;
var edgeOffset = 1.5 + edgeFactor;

var noiseSettings = layer.getNoiseSettings();
var noiseHeightMap;
var noiseOffset;
if (noiseSettings != null)
{
    var NoiseHeightMap = Java.type("org.pepsoft.worldpainter.heightMaps.NoiseHeightMap");
    noiseHeightMap = new NoiseHeightMap(noiseSettings, 135101785);
    noiseHeightMap.setSeed(dimension.getSeed());
    noiseOffset = noiseSettings.getRange();
}
else
{
    noiseHeightMap = null;
    noiseOffset = 0;
}

var minHeight = dimension.isBottomless() ? 0 : 1;


print("Carving the ground and increasing water level...")
var rect = dimension.getExtent();
var xMin = rect.getX() * 128;
var yMin = rect.getY() * 128;
for (var x = xMin; x < rect.getWidth() * 128 + xMin; x++)
{
    for (var y = yMin; y < rect.getHeight() * 128 + yMin; y++)
    {
        if (!dimension.isTilePresent(truncate((x + xMin) / 128.0), truncate((y + yMin) / 128.0) ))
            continue;

        if (dimension.getBitLayerValueAt(layer, x, y) == 0)
            continue;

        var terrainHeight = dimension.getHeightAt(x, y);

        var effectiveThickness = Math.abs(thickness);
        if (taperedEdge)
        {
            var distanceToEdge = dimension.getDistanceToEdge(layer, x, y, edgeWidth + 1);
            if (distanceToEdge < edgeWidth + 1)
            {
                var normalizedDistance = (distanceToEdge - 1) / (edgeWidth - 1);
                if (edgeShape == org.pepsoft.worldpainter.layers.groundcover.GroundCoverLayer.EdgeShape.LINEAR)
                {
                    effectiveThickness = truncate(1.5 + normalizedDistance * edgeThickness);
                }
                else if (edgeShape == org.pepsoft.worldpainter.layers.groundcover.GroundCoverLayer.EdgeShape.SMOOTH)
                {
                    effectiveThickness = truncate(edgeOffset + -Math.cos(normalizedDistance * Math.PI) * edgeFactor);
                }
                else if (edgeShape == org.pepsoft.worldpainter.layers.groundcover.GroundCoverLayer.EdgeShape.ROUNDED)
                {
                    var reversedNormalizedDistance = 1 - (distanceToEdge - 0.5) / edgeWidth;
                    effectiveThickness = truncate(1.5 + Math.sqrt(1 - reversedNormalizedDistance * reversedNormalizedDistance) * edgeThickness);
                }

            }
        }
        
        if (noiseHeightMap != null)
        {
            effectiveThickness += noiseHeightMap.getHeight(x, y) - noiseOffset;
        }

        //water
        var waterHeight = dimension.getWaterLevelAt(x, y);
        if (waterHeight < terrainHeight + params["waterOffset"])
            dimension.setWaterLevelAt(x, y, terrainHeight + params["waterOffset"]);

        //terrain
        var newHeight = terrainHeight - effectiveThickness;


        if (waterHeight > terrainHeight)
        {
            newHeight = waterHeight - effectiveThickness;
            if (terrainHeight < newHeight)
                newHeight = terrainHeight;
        }

        if (newHeight < minHeight)
            newHeight = minHeight;

        dimension.setHeightAt(x, y, newHeight);


    }
}

if (params["biome"])
{
    print("Setting River biome...")
    var biomeLayer = wp.getLayer().withName("Biomes").go();

    for (var x = xMin; x < rect.getWidth() * 128 + xMin; x++)
    {
        for (var y = yMin; y < rect.getHeight() * 128 + yMin; y++)
        {
            if (!dimension.isTilePresent(truncate((x + xMin) / 128.0), truncate((y + yMin) / 128.0) ))
                continue;

            if (dimension.getBitLayerValueAt(layer, x, y) == 0)
                continue;

            if (dimension.getLayerValueAt(biomeLayer, x, y) == 0)
                continue;

            dimension.setLayerValueAt(biomeLayer, x, y, 7);
        }
    }
}

if (params["delete"])
{
    print("Removing layer...")
    for (var x = xMin; x < rect.getWidth() * 128 + xMin; x++)
    {
        for (var y = yMin; y < rect.getHeight() * 128 + yMin; y++)
        {
            if (!dimension.isTilePresent(truncate((x + xMin) / 128.0), truncate((y + yMin) / 128.0) ))
                continue;

            if (dimension.getBitLayerValueAt(layer, x, y) == 0)
                continue;

            dimension.setBitLayerValueAt(layer, x, y, 0);
        }
    }
}

print("Done! :D");

function truncate(number)
{
    return number > 0
         ? Math.floor(number)
         : Math.ceil(number);
}