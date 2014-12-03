// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// http://bl.ocks.org/mbostock/7621155
var superscript = {"0":"⁰",
                   "1":"¹",
                   "2":"²",
                   "3":"³",
                   "4":"⁴",
                   "5":"⁵",
                   "6":"⁶",
                   "7":"⁷",
                   "8":"⁸",
                   "9":"⁹",
                   ".":"·",
                   "-":"⁻"
                 }
var formatPower = function(d) { return (d + "").split("").map(function(c) { return superscript[c]; }).join(""); };

var originalImageData;
var SVG_MAX_WIDTH = 500, SVG_MAX_HEIGHT = 500;
var imageWidth, imageHeight;
var topColors;
var colorDistanceGroupTolerance = 12;
var colorDistancePointTolerance = 6;

var isDragging = false;
var startCorner, stopCorner;
var selectedPoints = {};
var scales = {};

var svgMargin = {top: 20, right: 20, bottom: 20, left: 70}

$(document).ready(function() {
  // OverlayCanvas Drag and Drop
  $("#overlayCanvas").on("mousedown", function(e) {
    isDragging = true;
    startCorner = [e.offsetX, e.offsetY]
    return false;
  });
  $("#overlayCanvas").on("mousemove", function(e) {
    if (!isDragging) {
      return;
    }

    var ctx = this.getContext("2d")
    ctx.clearRect(0, 0, imageWidth, imageHeight)
    ctx.beginPath()
    ctx.setLineDash([5,10]); // chrome specific
    ctx.rect(Math.min(startCorner[0], e.offsetX),
             Math.min(startCorner[1], e.offsetY),
             Math.abs(startCorner[0] - e.offsetX),
             Math.abs(startCorner[1] - e.offsetY))
    ctx.strokeStyle="red"
    ctx.stroke()
    ctx.closePath()
    return false;
  })
  $("#overlayCanvas").on("mouseup", function(e) {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    stopCorner = [e.offsetX, e.offsetY]
    // For convenience, have startCorner < stopCorner
    if (e.offsetX < startCorner[0]) {
      stopCorner[0] = startCorner[0]
      startCorner[0] = e.offsetX
    }
    if (e.offsetY < startCorner[1]) {
      stopCorner[1] = startCorner[1]
      startCorner[1] = e.offsetY
    }
    return false;
  })

  // Select Colors
  $("#colorUI").on("click", "input[type=checkbox]", function() {
    if (this.checked) {
      if (!startCorner || !stopCorner) {
        this.checked = false;
        alert("Please indicate grid bounds.")
        return;
      }

      $("#pointsDiv").css("z-index", "3")
      var rgb = topColors[this.value]
      rgb = [rgb.r, rgb.g, rgb.b]
      var points = extractRawDataForColor(rgb)
      for (var i = 0; i < points.length; i++) {
        var p = points[i]
        if (   p[0] < startCorner[0]
            || p[0] > stopCorner[0]
            || p[1] < startCorner[1]
            || p[1] > stopCorner[1]) {
          points.remove(i)
          i -= 1
        }
      }
      selectedPoints[this.value] = points
      drawSelectedPoints()
    } else {
      selectedPoints[this.value] = []
      $(".selected_points_"+this.value).remove()
      if ($("input:checked").length == 0) {
        $("#pointsDiv").css("z-index", "1")
      }
    }
  });
  $("#pointsDiv").on("click", ".removable", function() {
    var selectedGroup = $(this).attr("class").split("_")[2]
    var point = this.__data__
    var index = selectedPoints[selectedGroup].indexOf(point)
    if (index != -1) {
      selectedPoints[selectedGroup].remove(index)
      $(this).remove()
    }
  })

  // Change Scale
  $("#axis-y-type").on("change", function() {
    if (this.value == "Linear") {
      $("#axis-base-row").hide()
    } else {
      $("#axis-base-row").show()
    }
  });

  // Generate Views
  $("#generateViews").on("click", function() {
    if (!startCorner || !stopCorner) {
      alert("Please indicate grid bounds.")
      return;
    }
    if ($("input:checked").length == 0) {
      alert("Please identify line colors.")
      return;
    }
    var axisStart = parseFloat($("#axis-y-start").val())
    var axisEnd = parseFloat($("#axis-y-end").val())
    var axisType = $("#axis-y-type").val()
    var base = parseFloat($("#axis-base").val())
    if (   isNaN(axisStart)
        || isNaN(axisEnd)
        || (axisType == "Logarithmic" && isNaN(base))) {
      alert("Please describe the Y axis.")
      return;
    }

    generateViews(extractData())
  });

  // SVG Shared Interaction
  $("body").on("click", ".main_svg", function(e) {
    if ($("#ReView-table").is(":visible")) {
      var dataX, dataY;
      var divContainer = $(this).parent()
      if (divContainer.hasClass("ReView")) {
        if (   e.offsetX > svgMargin.left
            && e.offsetX < $(this).width() - svgMargin.right
            && e.offsetY > svgMargin.top
            && e.offsetY < $(this).height() - svgMargin.bottom) {
          var svgX = e.offsetX - svgMargin.left
          var svgY = e.offsetY - svgMargin.top
          var scaleYString = "ReViewScaleY"
          scaleYString += divContainer.hasClass("Linear") ? "Linear" : "Logarithmic";
          scaleYString += divContainer.hasClass("big") ? "big" : "zoom";
          scaleYString += "-invert"
          dataX = scales["ReViewScaleX-invert"](svgX)
          dataY = scales[scaleYString](svgY)
        }
      } else {
        // svg over the original image
        var domainX = scales["imageToDataScaleX"].domain()
        var domainY;
        if (scales["imageToDataScaleY"].domain) {
          domainY = scales["imageToDataScaleY"].domain()
        } else {
          domainY = scales["imageToDataScaleY-invert"].range()
        }
        if (   e.offsetX > domainX[0]
            && e.offsetX < domainX[1]
            && e.offsetY > domainY[0]
            && e.offsetY < domainY[1]) {
          dataX = scales["imageToDataScaleX"](e.offsetX)
          dataY = scales["imageToDataScaleY"](e.offsetY)
        }
      }

      if (dataX && dataY) {
        // Clicked on valid shared location
        var main_svgs = $(".main_svg")
        for (var i = 0; i < main_svgs.length; i++) {
          var divContainer = $(main_svgs[i]).parent()
          var svg = d3.select(main_svgs[i]).select("g")
          var x, y, xmin, xmax, ymin, ymax;
          if (divContainer.hasClass("ReView")) {
            var scaleYString = "ReViewScaleY"
            scaleYString += divContainer.hasClass("Linear") ? "Linear" : "Logarithmic";
            scaleYString += divContainer.hasClass("big") ? "big" : "zoom";
            x = scales["ReViewScaleX"](dataX)
            y = scales[scaleYString](dataY)
            xmin = scales["ReViewScaleX"].range()[0]
            xmax = scales["ReViewScaleX"].range()[1]
            ymin = scales[scaleYString].range()[0]
            ymin = scales[scaleYString].range()[1]
          } else {
            x = scales["imageToDataScaleX-invert"](dataX)
            y = scales["imageToDataScaleY-invert"](dataY)
            xmin = scales["imageToDataScaleX"].domain()[0]
            xmax = scales["imageToDataScaleX"].domain()[1]
            var domainY;
            if (scales["imageToDataScaleY"].domain) {
              domainY = scales["imageToDataScaleY"].domain()
            } else {
              domainY = scales["imageToDataScaleY-invert"].range()
            }
            ymin = domainY[0]
            ymax = domainY[1]
          }

          svg.append("circle")
            .attr("class", "shared")
            .style("stroke", "black")
            .style("fill-opacity", 0)
            .attr("r", 4)
            .attr("cx", x)
            .attr("cy", y)
            .attr("stroke-width", "1px")
          svg.append("line")
            .attr("class", "shared")
            .attr("x1", xmin)
            .attr("x2", xmax)
            .attr("y1", y)
            .attr("y2", y)
            .attr("fill", "none")
            .attr("shape-rendering", "crispEdges")
            .attr("stroke", "black")
            .attr("stroke-width", "1px")
          svg.append("line")
            .attr("class", "shared")
            .attr("x1", x)
            .attr("x2", x)
            .attr("y1", ymin)
            .attr("y2", ymax)
            .attr("fill", "none")
            .attr("shape-rendering", "crispEdges")
            .attr("stroke", "black")
            .attr("stroke-width", "1px")

        }
      }
    }
  })

  // Clear Shared Points
  $("#clearShared").on("click", function() {
    $(".shared").remove()
  })
});

function extractData() {
  // Set up X Axis (default)
  scales["imageToDataScaleX"] = d3.scale.linear()
    .domain([startCorner[0], stopCorner[0]])
    .range([0, stopCorner[0] - startCorner[0]]);
  scales["imageToDataScaleX-invert"] = scales["imageToDataScaleX"].invert

  // Set up Y Axis
  var axisStart = parseFloat($("#axis-y-start").val())
  var axisEnd = parseFloat($("#axis-y-end").val())
  var axisType = $("#axis-y-type").val()
  if (axisType == "Linear") {
    scales["imageToDataScaleY"] = d3.scale.linear()
      .domain([startCorner[1], stopCorner[1]])
      .range([axisEnd, axisStart]) // flip to map 0 (pixel, i.e. top) to largest value
    scales["imageToDataScaleY-invert"] = scales["imageToDataScaleY"].invert
  } else if (axisType == "Logarithmic") {
    var base = parseFloat($("#axis-base").val())
    scales["imageToDataScaleY-invert"] = d3.scale.log()
      .base(base)
      .domain([axisEnd, axisStart]) // flip to map 0 (pixel, i.e. top) to largest value
      .range([startCorner[1], stopCorner[1]])
    scales["imageToDataScaleY"] = scales["imageToDataScaleY-invert"].invert // invert to get exponential relationship
  }

  // Get selected colors
  var colors = [];
  var grouped_points = []
  var minimum;
  var maximum;
  for (var j = 0; j < topColors.length; j++) {
    if (selectedPoints[j]) {
      var color = topColors[j]
      color = [color.r, color.g, color.b]
      colors.push(color)
      var points = selectedPoints[j];
      var mapped_points = [];
      // Extract Data
      for (var i = 0; i < points.length; i++) {
        var p = points[i]
        var mappedX = scales["imageToDataScaleX"](p[0])
        var mappedY = scales["imageToDataScaleY"](p[1])
        mapped_points.push([mappedX, mappedY])

        if (!minimum || mappedY < minimum) {
          minimum = mappedY
        }
        if (!maximum || mappedY > maximum) {
          maximum = mappedY
        }

      }

      points.sort(function(left, right) {
        return left[0] < right[0] ? -1 : 1
      });

      grouped_points.push(mapped_points)
    }
  }
  // // extractedData View
  // $("#extractedData").empty()
  // for (var i = 0; i < points.length; i++) {
  //   var p = points[i]
  //   var x = p[0].toFixed(2)
  //   var y = p[1].toFixed(2)
  //   $("<div>" + x + ", " + y + "</div>").appendTo($("#extractedData"))
  // }

  // Prepare data
  var data = { "colors": colors,
               "grouped_points": grouped_points,
               "axisRange": [axisStart, axisEnd],
               "dataRange": [minimum, maximum] }

  return data
}

/*
data: {
  "colors": array of [r,g,b],
  "grouped_points": array of arrays of [x, y],
  "axisRange": [low, high],
  "dataRange": [minimum, maximum]
  }
*/
function generateViews(data) {
  // http://bl.ocks.org/mbostock/3883245
  var width = stopCorner[0] - startCorner[0]
  var height = stopCorner[1] - startCorner[1]
  var scale = Math.min(1, SVG_MAX_WIDTH / width, SVG_MAX_HEIGHT / height)
  var svgSize = { width: width * scale, height: height * scale }
  // Set up Shared X Axis (Default)
  scales["ReViewScaleX"] = d3.scale.linear()
    .domain([0, stopCorner[0] - startCorner[0]])
    .range([0, svgSize.width]);
  scales["ReViewScaleX-invert"] = scales["ReViewScaleX"].invert

  var views = $(".ReView")
  views.empty()
  for (var i = 0; i < views.length; i++) {
    var v = views[i]

    // Set up Y Scale and Axis
    var scaleY;
    var yAxis = d3.svg.axis()
      .orient("left");
    var zero_point = $(v).hasClass("Linear") ? 0 : Math.min(1, data.dataRange[0])
    var baseline = $(v).hasClass("big") ? zero_point : data.dataRange[0]
    // Zoom out for big picture if necessary
    var ceiling;
    if ($(v).hasClass("big")) {
      var axis_data_ratio_threshold = 4 // somewhat arbitrary threshold
      if ($(v).hasClass("Logarithmic")) {
        var data_ratio = data.dataRange[1] / data.dataRange[0]
        var axis_ratio = data.axisRange[1] / baseline
        ceiling = Math.max(data.axisRange[1],
                           data.axisRange[1] * Math.pow(data_ratio, axis_data_ratio_threshold) / axis_ratio)
      } else {
        var data_diff = data.dataRange[1] - data.dataRange[0]
        ceiling = Math.max(data.axisRange[1],
                           data_diff  * axis_data_ratio_threshold)
      }
    } else {
      ceiling = data.dataRange[1]
    }

    if ($(v).hasClass("Linear")) {
      var data_axis_ratio = data_diff / (ceiling - baseline)
      scaleY = d3.scale.linear()
        .domain([baseline, ceiling])
        .range([svgSize.height, 0]) // flip to map 0 to svg height (bottom)
        .nice()
      yAxis.scale(scaleY)
        .tickFormat(d3.format(",f"))

    } else if ($(v).hasClass("Logarithmic")) {
      // Determine base
      var maxRatio = ceiling / baseline
      var base, formatBase, spacing;
      if (maxRatio >= 1000) {
        base = 10
        formatBase = 10
        spacing = 1
      } else if (maxRatio >= 3) { // somewhat arbitrary threshold
        base = 2
        formatBase = 2
        spacing = 1
      } else {
        var maxPower = logBase(data.dataRange[1], Math.E)
        var minPower = logBase(data.dataRange[0], Math.E)
        var possible_spacings = [.1, .05, .01]
        var log_diff = maxPower - minPower
        for (var j = 0; j < possible_spacings.length; j++) {
          spacing = possible_spacings[j]
          base = Math.pow(Math.E, spacing)
          if (log_diff / spacing >= 6) {
            break;
          }
        }
        formatBase = Math.E
      }

      // XXX: Does not handle minimum=0 well. Think of something better?
      scaleY = d3.scale.log()
        .base(base)
        .domain([baseline, ceiling])
        .range([svgSize.height, 0]) // flip to map 0 to svg height (bottom)
        .nice()
        .clamp(true)

      yAxis.scale(scaleY)
        .tickFormat(logFormat(formatBase, spacing))
    }

    var line = d3.svg.line()
      .x(function(d) { return scales["ReViewScaleX"](d[0]); })
      .y(function(d) { return scaleY(d[1]); })

    // Store scaleY
    var scaleYString = "ReViewScaleY";
    scaleYString += $(v).hasClass("Linear") ? "Linear" : "Logarithmic"
    scaleYString += $(v).hasClass("big") ? "big" : "zoom"
    scales[scaleYString] = scaleY
    scales[scaleYString + "-invert"] = scaleY.invert

    // Begin Drawing
    // Orient svg
    var svg = d3.select(v)
    .append("svg")
      .attr("width", svgSize.width + svgMargin.left + svgMargin.right)
      .attr("height", svgSize.height + svgMargin.top + svgMargin.bottom)
      .attr("class", "main_svg")
    .append("g")
      .attr("transform", "translate(" + svgMargin.left + "," + svgMargin.top + ")");

    // Y Axis
    svg.append("g")
     .attr("class", "y axis")
     .call(yAxis)

    // Y Grid Lines
    // http://stackoverflow.com/questions/15580300/proper-way-to-draw-gridlines
    svg.selectAll("line.horizontalGrid")
      .data(scaleY.ticks())
    .enter()
      .append("line")
      .attr("class", "horizontalGrid")
      .attr("x1", 1)
      .attr("x2", svgSize.width)
      .attr("y1", function(d) { return scaleY(d) })
      .attr("y2", function(d) { return scaleY(d) })
      .attr("fill", "none")
      .attr("opacity", ".5")
      .attr("shape-rendering", "crispEdges")
      .attr("stroke", "LightGray")
      .attr("stroke-width", "1px")

    for (var j=0; j < data.grouped_points.length; j++ ) {
      // Line
      svg.append("path")
        .datum(data.grouped_points[j])
        .attr("class", "line")
        .attr("d", line)
        .attr("stroke", rgbToHex(data.colors[j]))
      }
  }

  $("#ReView-table").show()
}

// Called by background.js
function setScreenshot(url, dim) {
  var canvas = document.getElementById('screenshotCanvas')
  var overlay = document.getElementById('overlayCanvas')
  var ctx = canvas.getContext("2d")
  var imageObj = new Image()

  $("#canvasContainer").width(dim.width)
  $("#canvasContainer").height(dim.height)
  $("#pointsDiv").width(dim.width)
  $("#pointsDiv").height(dim.height)
  canvas.width = dim.width
  canvas.height = dim.height
  overlay.width = dim.width
  overlay.height = dim.height
  imageWidth = dim.width;
  imageHeight = dim.height;

  d3.select("#pointsDiv")
  .append("svg")
    .attr("width", imageWidth)
    .attr("height", imageHeight)
    .attr("class", "main_svg")
  .append("g")

  imageObj.onload = function() {
    // Get image data by drawing screenshot onto canvas
    ctx.drawImage(imageObj, dim.x, dim.y, dim.width, dim.height, 0, 0, dim.width, dim.height)
    /*
     * Filter to smooth out small variations in color.
     * ReVision uses bilateral filter. Is this equivalent?
     * Does not seem to be effective in helping color issues.
     */
    // sharpen(ctx, dim.width, dim.height, .05)
    originalImageData = ctx.getImageData(0, 0, dim.width, dim.height)

    screenshotLoaded()
  }

  imageObj.src = url // will trigger onLoad
}

// Set up wpd
function screenshotLoaded() {
  loadColorUI()

  // Prepare wpd state for data extraction
  var plotData = wpd.appData.getPlotData()
  var autoDetector = plotData.getAutoDetector()

  autoDetector.imageData = originalImageData
  autoDetector.algorithm = new wpd.AveragingWindowAlgo()
  autoDetector.colorDetectionMode = "fg"
  autoDetector.colorDistance = colorDistancePointTolerance
  // from wpd.alignAxes for Image Axes
  // Use image pixel size as axes
  var imageAxes = new wpd.ImageAxes();
  imageAxes.calibrate();
  plotData.axes = imageAxes;
}


// color: [r, g, b], max=255
function extractRawDataForColor(color) {
  var plotData = wpd.appData.getPlotData()
  var autoDetector = plotData.getAutoDetector()

  autoDetector.fgColor = color

  // Run data extraction algorithm
  plotData.dataSeriesCol1 = [] // reset ActiveDataSeries
  autoDetector.generateBinaryData(); // needs colorDetectionMode and fgColor set
  var algoCore = new wpd.AveragingWindowCore(autoDetector.binaryData, imageHeight, imageWidth, 3, 3, plotData.getActiveDataSeries())
  algoCore.run()
  return plotData.getDataFromActiveSeries()
}

function loadColorUI() {
  topColors = wpd.colorAnalyzer.getTopColorsWithTolerance(originalImageData, colorDistanceGroupTolerance);
  // Filter Poor Colors
  for (var i = 0; i < topColors.length; i++) {
    var topColor = topColors[i]
    if (topColor.pixels < 15) {
      topColors.remove(i)
      i--;
    }
  }
  var colorUI = $("#colorUI")
  var colorUIhtml = ""
  var numColumns = topColors.length >= 11 ? 3 : 2 // values somewhat arbitrary
  for (var i = 0; i < topColors.length; i++) {
    if (i == 0) {
      colorUIhtml += "<td>"
    } else if (i == Math.ceil(topColors.length / numColumns)) {
      colorUIhtml += '</td><td>'
    } else if (i == 2 * Math.ceil(topColors.length / numColumns)) {
      colorUIhtml += '</td><td>'
    }

    var c = topColors[i]
    c = [c.r, c.g, c.b]
    var rgbString = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"
    colorUIhtml +=
      '<input type="checkbox" value="' + i + '">' +
       '<div ' +
        'class="colorUI-choice" ' +
        'style="background-color:' + rgbString + '" ' +
        'data-value="' + i + '" ' +
      '></div></input><br>'

    if (i == topColors.length - 1) {
      colorUIhtml += '</td>'
    }
  }
  $(colorUIhtml).appendTo(colorUI)

  // $("#colorUI").on('click', '.colorUI-choice', function(e) {
  //   a = $(e.target)
  //   var i = parseInt(a.data('value'))
  //   var c = topColors[i]
  //   c = [c.r, c.g, c.b]

  //   Test Color Distances
  //   console.log(a)
  //   for (var j = 0; j < topColors.length; j++) {
  //     var rgb = topColors[j]
  //     var rgb = [rgb.r, rgb.g, rgb.b]
  //     console.log(wpd.colorTools.colorDistance(rgb, c))
  //   }
  // });
}

function drawSelectedPoints() {
  var svg = d3.select("#pointsDiv g")
  // Line
  for (var i = 0; i < topColors.length; i++) {
    if (selectedPoints[i]) {
      var color = topColors[i]
      color = [color.r, color.g, color.b]
      var d3points = svg.selectAll(".selected_points_"+i)
        .data(selectedPoints[i])
      d3points.enter()
        .append("circle")
          .attr("class", "removable selected_points_"+i)
          .style("fill", rgbToHex(color))
          .style("stroke", "black")
          .attr("r", 3)
          .attr("cx", function(d) { return d[0]; })
          .attr("cy", function(d) { return d[1]; })
    }
  }
}

function logFormat(base, spacing) {
  return function(d) {
    var power = roundToSpacing(logBase(d, base), spacing)
    if (base != Math.E) {
      var multiplier = Math.round(d / Math.pow(base, power))
      if (multiplier != 1) {
        return ""
      }
      return base + formatPower(power);
    } else {
      return "e" + formatPower(power);
    }
  }
}

function logBase(value, base) {
  return Math.log(value) / Math.log(base)
}
function roundToSpacing(value, spacing) {
  var numDecimals = Math.ceil(logBase(1 / spacing, 10))
  // Add spacing/100 to value to deal with rounding errors
  // while guaranteeing that it will not mathematically affect val
  var val = Math.floor((value + spacing/100) / spacing) * spacing
  return val.toFixed(numDecimals)
}

// http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function rgbToHex(rgb) {
    return "#" + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1);
}

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

// http://jsfiddle.net/AbdiasSoftware/ddJZB/
function sharpen(ctx, w, h, mix) {

    var weights = [0, -1, 0, -1, 5, -1, 0, -1, 0],
        katet = Math.round(Math.sqrt(weights.length)),
        half = (katet * 0.5) | 0,
        dstData = ctx.createImageData(w, h),
        dstBuff = dstData.data,
        srcBuff = ctx.getImageData(0, 0, w, h).data,
        y = h;

    while (y--) {

        x = w;

        while (x--) {

            var sy = y,
                sx = x,
                dstOff = (y * w + x) * 4,
                r = 0,
                g = 0,
                b = 0,
                a = 0;

            for (var cy = 0; cy < katet; cy++) {
                for (var cx = 0; cx < katet; cx++) {

                    var scy = sy + cy - half;
                    var scx = sx + cx - half;

                    if (scy >= 0 && scy < h && scx >= 0 && scx < w) {

                        var srcOff = (scy * w + scx) * 4;
                        var wt = weights[cy * katet + cx];

                        r += srcBuff[srcOff] * wt;
                        g += srcBuff[srcOff + 1] * wt;
                        b += srcBuff[srcOff + 2] * wt;
                        a += srcBuff[srcOff + 3] * wt;
                    }
                }
            }

            dstBuff[dstOff] = r * mix + srcBuff[dstOff] * (1 - mix);
            dstBuff[dstOff + 1] = g * mix + srcBuff[dstOff + 1] * (1 - mix);
            dstBuff[dstOff + 2] = b * mix + srcBuff[dstOff + 2] * (1 - mix)
            dstBuff[dstOff + 3] = srcBuff[dstOff + 3];
        }
    }

    ctx.putImageData(dstData, 0, 0);
}