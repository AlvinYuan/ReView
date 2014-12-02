var ModeEnum = Object.freeze({
    NORMAL: "normal",
    CLIP: "clip"
})
var mode = ModeEnum.NORMAL

$(document).ready(function () {
    chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.message == "startClip" && mode == ModeEnum.NORMAL) {
            mode = ModeEnum.CLIP
            console.log(mode)
            $('<div id="ReViewClipOverlay" class="gray-overlay"></div>').appendTo('body')
            addDragDropListeners()
        }
    });
});

var corner1, corner2;

function addDragDropListeners() {
    $('body').on('mousedown.ReViewClipOverlay', '#ReViewClipOverlay', function(e) {
        corner1 = { x: e.clientX, y: e.clientY }
        if (!document.getElementById("ReViewClippedArea")) {
            console.log("Start drag")
            $('#ReViewClipOverlay').removeClass('gray-overlay')
            $('<div id="ReViewClipOverlayTop" class="gray-overlay"></div>').appendTo($('#ReViewClipOverlay'))
            $('<div id="ReViewClipOverlayLeft" class="gray-overlay"></div>').appendTo($('#ReViewClipOverlay'))
            $('<div id="ReViewClippedArea"></div>').appendTo('#ReViewClipOverlay')
            $('<div id="ReViewClipOverlayRight" class="gray-overlay"></div>').appendTo($('#ReViewClipOverlay'))
            $('<div id="ReViewClipOverlayBottom" class="gray-overlay"></div>').appendTo($('#ReViewClipOverlay'))

            // Add drag/release listeners
            $('body').on('mousemove.ReViewClipOverlay', '#ReViewClipOverlay', function(e) {
                corner2 = { x: e.clientX, y: e.clientY }
                var dim = dimensions(corner1, corner2)
                var top = dim.y
                var left = dim.x
                var bottom = dim.y + dim.height
                var right = dim.x + dim.width
                $('#ReViewClippedArea').css({width: dim.width + "px",
                                             height: dim.height + "px"})
                $('#ReViewClipOverlayTop').css({height: top + "px"})
                $('#ReViewClipOverlayBottom').css({height: "calc(100% - " + bottom + "px)"})
                $('#ReViewClipOverlayLeft').css({width: left + "px",
                                                 height: dim.height + "px"})
                $('#ReViewClipOverlayRight').css({width: "calc(100% - " + right + "px)",
                                                  height: dim.height + "px"})
                return false;
            })
            $('body').on('mouseup.ReViewClipOverlay', '#ReViewClipOverlay', function(e) {
                corner2 = { x: e.clientX, y: e.clientY }
                console.log(corner2)
                chrome.runtime.sendMessage({message: "getClip", dim: dimensions(corner1, corner2)}, function(response) {
                });

                // Clean up
                $('#ReViewClipOverlay').remove()
                $('body').off('mousedown.ReViewClipOverlay')
                $('body').off('mousemove.ReViewClipOverlay')
                $('body').off('mouseup.ReViewClipOverlay')
                mode = ModeEnum.NORMAL
                return false;
            })
            return false;
        }
    })
}

function dimensions(corner1, corner2) {
    console.log(corner1)
    console.log(corner2)
    var dim = { x:0, y:0, width:0, height:0 }
    dim.x = Math.min(corner1.x, corner2.x)
    dim.width = Math.abs(corner1.x - corner2.x)
    dim.y = Math.min(corner1.y, corner2.y)
    dim.height = Math.abs(corner1.y - corner2.y)
    return dim
}