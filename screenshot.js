// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var originalImageData;
var imageWidth, imageHeight;
var topColors;
var colorDistanceGroupTolerance = 20;
var colorDistancePointTolerance = 5;

$(document).ready(function() {
  $("#generateViews").on("click", function(e) {
    var axisStart = parseFloat($("#axis-start").val())
    var axisEnd = parseFloat($("#axis-end").val())
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
function extractDataForColor(color) {
  var plotData = wpd.appData.getPlotData()
  var autoDetector = plotData.getAutoDetector()

  autoDetector.fgColor = color

  // Run data extraction algorithm
  plotData.dataSeriesCol1 = [] // reset ActiveDataSeries
  autoDetector.generateBinaryData(); // needs colorDetectionMode and fgColor set
  var algoCore = new wpd.AveragingWindowCore(autoDetector.binaryData, imageHeight, imageWidth, 5, 5, plotData.getActiveDataSeries())
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
    console.log(a)
    var i = parseInt(a.data('value'))
    var c = topColors[i]
    c = [c.r, c.g, c.b]
    drawImageWithPoints(extractDataForColor(c))
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