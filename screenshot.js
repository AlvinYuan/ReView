// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var originalImageData;
var imageWidth, imageHeight;
var topColors;
var colorDistanceGroupTolerance = 20;
var colorDistancePointTolerance = 5;

var svgMargin = {top: 20, right: 20, bottom: 20, left: 70}
var imageToDataScaleX, imageToDataScaleY;

$(document).ready(function() {
  $("#generateViews").on("click", function(e) {
    var rgb = [topColors[1].r, topColors[1].g, topColors[1].b]
    var points = extractRawDataForColor(rgb)

    // Translate points from image pixel range to data range
    var axisStart = parseFloat($("#axis-y-start").val())
    var axisEnd = parseFloat($("#axis-y-end").val())
    // TODO: Add way to specify largest value on top or on bottom
    imageToDataScaleY.range([axisEnd, axisStart]) // flip to map 0 (pixel, i.e. top) to largest value
    for (var i = 0; i < points.length; i++) {
      var p = points[i]
      p[0] = imageToDataScaleX(p[0])
      p[1] = imageToDataScaleY(p[1])
    }

    // extractedData View
    $("#extractedData").empty()
    for (var i = 0; i < points.length; i++) {
      var p = points[i]
      var x = p[0].toFixed(2)
      var y = p[1].toFixed(2)
      $("<div>" + x + ", " + y + "</div>").appendTo($("#extractedData"))
    }

    // ReView1
    // http://bl.ocks.org/mbostock/3883245
    var svgSize = { width: imageWidth, height: imageHeight }
    var dataToLinear0ScaleX = d3.scale.linear()
      .domain([0, d3.max(points, function(d) { return d[0]; })])
      .range([0, svgSize.width])
    var dataToLinear0ScaleY = d3.scale.linear()
      .domain([0, axisEnd])
      .range([svgSize.height, 0]) // flip to map 0 to svg height (bottom)
    var yAxis = d3.svg.axis()
      .scale(dataToLinear0ScaleY)
      .orient("left");
    var line = d3.svg.line()
      .x(function(d) { return dataToLinear0ScaleX(d[0]); })
      .y(function(d) { return dataToLinear0ScaleY(d[1]); })

    $("#ReView1").empty()
    var svg = d3.select("#ReView1")
      .attr("width", svgSize.width + svgMargin.left + svgMargin.right)
      .attr("height", svgSize.height + svgMargin.top + svgMargin.bottom)
    .append("g")
      .attr("transform", "translate(" + svgMargin.left + "," + svgMargin.top + ")");

    svg.append("g")
     .attr("class", "y axis")
     .call(yAxis)
    svg.append("path")
      .datum(points)
      .attr("class", "line")
      .attr("d", line)
  });
});

function setScreenshot(url, dim) {
  var canvas = document.getElementById('screenshotCanvas')
  var ctx = canvas.getContext("2d")
  var imageObj = new Image()

  canvas.width = dim.width
  canvas.height = dim.height
  imageWidth = dim.width;
  imageHeight = dim.height;

  // Default Scales
  imageToDataScaleX = d3.scale.linear()
    .domain([0, imageWidth])
    .range([0, imageWidth]);
  imageToDataScaleY = d3.scale.linear()
    .domain([0, imageHeight])
    .range([0, imageHeight]);

  imageObj.onload = function() {
    // Get image data by drawing screenshot onto canvas
    ctx.drawImage(imageObj, dim.x, dim.y, dim.width, dim.height, 0, 0, dim.width, dim.height)
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
  var colorUI = $("#colorUI")
  for (var i = 0; i < topColors.length; i++) {
    var c = topColors[i]
    c = [c.r, c.g, c.b]
    var rgbString = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"
    $('<div ' +
        'class="colorUI-choice" ' +
        'style="background-color:' + rgbString + '" ' +
        'data-value="' + i + '" ' +
      '></div>').appendTo(colorUI)
  }

  $("#colorUI").on('click', '.colorUI-choice', function(e) {
    a = $(e.target)
    var i = parseInt(a.data('value'))
    var c = topColors[i]
    c = [c.r, c.g, c.b]
    drawImageWithPoints(extractRawDataForColor(c))

    // Test Color Distances
    console.log(a)
    for (var j = 0; j < topColors.length; j++) {
      var rgb = topColors[j]
      var rgb = [rgb.r, rgb.g, rgb.b]
      console.log(wpd.colorTools.colorDistance(rgb, c))
    }
  });
}

function drawImageWithPoints(points) {
  var canvas = document.getElementById('screenshotCanvas')
  var ctx = canvas.getContext("2d")
  ctx.clearRect(0, 0, imageWidth, imageHeight)
  ctx.putImageData(originalImageData, 0, 0)

  // Draw Points
  for (var i = 0; i < points.length; i++) {
    p = points[i]
    radius = 3
    ctx.beginPath();
    ctx.arc(p[0], p[1], radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = 'green';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#003300';
    ctx.stroke();
  }
}

// http://stackoverflow.com/questions/19491336/get-url-parameter-jquery
function getUrlParameter(sParam)
{
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++)
    {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam)
        {
            return sParameterName[1];
        }
    }
}