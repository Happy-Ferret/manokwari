var DataChanged = 1;
var activePage = null;

function inherit() {
    var superclasses = [];

    if (arguments.length < 2) {
        throw new Error("At least one object must be specified to be inherited from another");
    }

    var copyProto = function(subclass, superclass) {
        for (var f in superclass.prototype) {
            if (f != "constructor" ) {
                if (subclass.prototype[f] == undefined) {
                    subclass.prototype[f] = function() {
                        return superclass.prototype[f].apply(this, arguments);
                    }
                }
            }
        }
    }

    var subclass   = arguments[0];
    var superclass = arguments[1];
    var t = function() {};
    t.prototype = superclass.prototype;
    subclass.prototype = new t();
    subclass.prototype.constructor = subclass;
    subclass.superclass = superclass.prototype;

    /* Copy all super classes functions */
    for (var i = 2; i < arguments.length; i ++) {
        copyProto(subclass, arguments[i]);
    }
}

function EventClass() {
    this.connections = {};
}

EventClass.prototype.constructor = EventClass;
EventClass.prototype.connect = function(type, obj, callback) {
    if (typeof this.connections == "undefined") {
        this.connections = {};
    }

    if (typeof this.connections[type] == "undefined") {
        this.connections[type] = [];
    }
    var c = { obj: obj, callback: callback }
    this.connections[type].push(c);
}

EventClass.prototype.emit = function(event) {
    // Just return if the connections are note yet established
    if (typeof this.connections == "undefined") {
        return; 
    }

    if (typeof event == "number") {
        event = { type: event, target: this };
    }
    if (this.connections[event.type] instanceof Array) {
        for (var i = 0; i < this.connections[event.type].length; i ++) {
            var c = this.connections[event.type][i];
            c.callback.call(c.obj, event);
        }
    }
}


function MenuData() {
    this.data = {};
    this.update();
}
inherit(MenuData, EventClass);

MenuData.prototype.set = function(value) {
    this.update();
    this.emit(DataChanged);
}

MenuData.prototype.constructor = MenuData;

MenuData.prototype.update = function() {
}

function FavoritesData() {
    this.backend = new Favorites();
    this.data = this.backend.update();
    this.dataReady = true;
}
inherit(FavoritesData, MenuData);
FavoritesData.prototype.constructor = FavoritesData;

FavoritesData.prototype.update = function() {
    this.dataReady = false;
    this.data = this.backend.update();
    this.emit(DataChanged);
    this.dataReady = true;
}

function XdgData(name) {
    this.name = name;
    this.backend = new XdgDataBackEnd(name);
    this.data = this.backend.update();
    this.dataReady = true;
}
inherit(XdgData, MenuData);
XdgData.prototype.constructor = XdgData;

XdgData.prototype.update = function() {
    this.dataReady = false;
    this.data = this.backend.update();
    this.emit(DataChanged);
    this.dataReady = true;
}

function PlacesData() {
    this.backend = new Places();
    this.data = this.backend.update();
    this.dataReady = true;
}
inherit(PlacesData, MenuData);
PlacesData.prototype.constructor = PlacesData;

PlacesData.prototype.update = function() {
    this.dataReady = false;
    this.data = this.backend.update();
    this.emit(DataChanged);
    this.dataReady = true;
}

/* MenuList */
function MenuList(data) {
    if (!(data instanceof MenuData)) {
        throw new Error("MenuList requires an MenuData to be attached");
    }
    this.data = data;
    this.type = "plain";
}
MenuList.prototype.constructor = MenuList;

MenuList.prototype.dataChanged = function(event) {
    console.log("dataChanged: " + this.element);
    this.render();
}

MenuList.prototype.attach = function(id) {
    var e = $("#" + id); 
    if (e.length == 0) {
        throw new Error("MenuList can't be attached to non-existence element");
    }
    this.element = "#" + id;
    this.data.connect(DataChanged, this, this.dataChanged); 
    if (this.data.dataReady) {
        this.render();
    }
}

MenuList.prototype.render = function() {
    if (this.type == "plain") {
        this.render_plain();
    } else {
        this.render_collapsible();
    }
}

MenuList.prototype.handle_tap = function(event) {
    var desktop = event.data.desktop;
    var uri = event.data.uri;
    var command = event.data.command;

    console.log("xxx");
    if (typeof uri !== "undefined") {
        Utils.open_uri(uri);
    } else if (typeof desktop !== "undefined"){
        Utils.run_desktop(desktop);
    } else if (typeof command !== "undefined") {
        Utils.run_command(command);
    }
}

MenuList.prototype.handle_tap_hold = function(event) {
    var text = event.data.text;
    var desktop = event.data.desktop;
    var uri = event.data.uri;
    var command = event.data.command;

    // HACK
    var in_favorites = (typeof uri === "undefined") && (typeof command === "undefined");
    if (in_favorites) {
        $("#remove_from_favorites_button").attr("desktop", desktop);
        $("#remove_from_fav_caption").text(text);
        changePage($("#remove_from_favorites"), {
            role: "dialog",
            transition: "fade"
        });
    }
}

MenuList.prototype.handle_tap_hold_applications = function(event) {
    var text = event.data.text;
    var desktop = event.data.desktop;
    var uri = event.data.uri;
    var command = event.data.command;

    $("#add_to_favorites").attr("desktop", desktop);
    $("#add_to_desktop").attr("desktop", desktop);
    $("#add_to_fav_or_desktop_caption").text(text);
    changePage($("#add_to_fav_or_desktop"), {
        role: "dialog",
        transition: "fade"
    });
}

MenuList.prototype.render_plain = function() {
    $(this.element).empty();

    if (this.data.data === undefined) {
        console.log("Data is not connected in the model");
    }


    for (var i = 0; i < this.data.data.length; i ++) {
        var entry = this.data.data[i];
        if (entry.isHeader == true) {
            var li  = $("<li>", { 
                        "data-icon": "false",
                        "text": entry.name
                    }
                );
            $(this.element).append(li);
        } else {
            var desktop = entry.desktop;
            var name = entry.name;
            var uri = entry.uri;
            var command = entry.command;
            var li  = $("<li>", { "data-icon": "false" });
            var a   = $("<a/>", {
                            "id" : "desktop_" + this.element.replace("#", "") + "_"+ i,
                            "href": "#",
                            "desktop": desktop,
                            "uri": uri,
                            "command": command
                        });
            a.on("taphold", { "text": a.text(), "uri": uri, "desktop": desktop, "command": command }, MenuList.prototype.handle_tap_hold);
            a.on("tap", { "uri": uri, "desktop": desktop, "command": command }, MenuList.prototype.handle_tap);
            var img = $("<img/>", {
                            "width": 24,
                            "height": 24,
                            "src": entry.icon,
                            "class": "ui-listview-item-icon"
                        });

            var span = $("<span/>", {
                            "translate": "no",
                            "text": name,
                            "title": name,
                            "class": "ui-listview-item-text"
                        });

            $(this.element).append(li);
            li.append(a);
            a.append(img);
            a.append(span);
        }
    }

    refreshStyle($(this.element));
}

MenuList.prototype.render_collapsible = function() {
    $(this.element).empty();

    if (this.data.data === undefined) {
        console.log("Data is not connected in the model");
    }

    for (var j = 0; j < this.data.data.length; j ++) {
        var entry = this.data.data[j];
        var div = $("<div/>", {
                     "data-role": "collapsible",
                     "data-iconpos": "right"
                   });
        var h3  = $("<div/>", {
                     "data-role": "collapsible-header", 
                     "text": entry.name
                   });
        var img = $("<img/>", {
                     "width": 24,
                     "height": 24,
                     "src": entry.icon,
                   });

        div.append(h3);
        $(this.element).append(div);

        if (typeof entry.children != "undefined") {
            var group = $('<div/>', {
                    "data-role": "controlgroup"
                   });
                   
            div.append(group);
            for (var i = 0; i < entry.children.length; i ++) {
                var desktop = entry.children[i].desktop;
                var name = entry.children[i].name;
                var uri = entry.children[i].uri;
                var command = entry.children[i].command;
                var a   = $("<a/>", {
                                "id" : "desktop_" + this.element.replace("#", "") + "_"+ i,
                                "href": "#",
                                "data-role": "button",
                                "desktop": desktop
                            });

                a.on("taphold", { "text": a.text(), "uri": uri, "desktop": desktop, "command": command }, MenuList.prototype.handle_tap_hold_applications);
                a.on("tap", { "uri": uri, "desktop": desktop, "command": command }, MenuList.prototype.handle_tap);

                var img = $("<img/>", {
                                "width": 24,
                                "height": 24,
                                "class": "ui-listview-item-icon",
                                "src": entry.children[i].icon
                            });
                var span = $("<span/>", {
                                "translate": "no",
                                "text": name,
                                "title": name
                            });
                a.append(img);
                a.append(span);
                group.append(a);
            }
        } 
    }
    refreshStyle($(this.element));
}

var dataApplications = new XdgData("applications.menu");
dataApplications.backend.updateCallback("dataApplications.update()");
var dataFavorites = new FavoritesData();
dataFavorites.backend.updateCallback("dataFavorites.update()");

var dataPlaces = new PlacesData();
dataPlaces.backend.updateCallback("dataPlaces.update()");

var sessionManager = new SessionManager();

$(document).ready(function() {

    var xdg = new MenuList(dataApplications);
    xdg.type = "collapsible";
    xdg.attach("listApplications");

    var fav = new MenuList(dataFavorites);
    fav.attach("listFavorites");

    var places = new MenuList(dataPlaces);
    places.attach("listPlaces");

    setup();
});

function updateData(d) {
    d.update();
}

function reset() {
    changePage($("#first"), {
        transition: "none"
    });

    $(".ui-collapsible-control-group").hide();
}

function setupPages() {
    $('div[data-role="page"]').hide();
    $('div[data-role="page"]').first().show();
}

function linkHandleTapHold(e, o) {
    // if the button is still pressed
    // until 1100 ms later then this is
    // truely a tap and hold gesture
    if (e.data.source.attr("mouse-is-down") == true) {
        o.trigger("taphold");
    }
    // reset all values
    e.data.source.attr("mouse-is-down", false);
    e.data.source.attr("mouse-down-time", -1);
}

function linkHandleMouseDown(e) {
    e.stopPropagation();
    e.preventDefault();

    var currentTime = new Date();

    // ignore if the button is already pressed
    if (e.data.source.attr("mouse-is-down") ==  true) {
        return;
    }

    // take note that this button is now pressed
    e.data.source.attr("mouse-is-down", true);
    // also put the timestamp so we can distinguish
    // later whether this is a long tap or not
    e.data.source.attr("mouse-down-time", currentTime);
    // kick the tap hold detector
    setTimeout(linkHandleTapHold, 1100, e, $(this));
}

function linkHandleMouseUp(e) {
    e.stopPropagation();
    e.preventDefault();

    // only consider the button which was pressed 
    if (e.data.source.attr("mouse-is-down") == true) {
        var currentTime = new Date();
        var lastTime = e.data.source.attr("mouse-down-time");
        if (typeof lastTime != "undefined" && (currentTime.getTime() - lastTime < 1000)) {

            // Just change if the href contains a page name
            if ($(this).attr("href") != "#") {
                changePage($($(this).attr("href")));
            } else {
            // or emit the "tap" signal
                $(this).trigger("tap");
            }

        }
        // reset the "down" state after finishing
        // meaning that the button's job is "done"
        e.data.source.attr("mouse-is-down", false);
    }
}

function linkHandleClick(e) {
    // just ignore clicks
    e.preventDefault();
    e.stopPropagation();
}

function setupLinks() {
    // all "a" elements are considered as "button"
    $('a').mousedown({ source: $(this)}, linkHandleMouseDown);
    $('a').mouseup({ source: $(this)}, linkHandleMouseUp);
    $('a').click({ source: $(this)}, linkHandleClick);
}

function setup() {
    setupPages();
    setupLinks();
    setupBasicStyle();
    setupAdditionalStyle();
    translate();
}

function setupX() {
    $("#add_to_desktop").bind("tap", function (event, ui) {
        XdgDataBackEnd.put_to_desktop($(this).attr("desktop"));
    });

    $("#add_to_favorites").bind("tap", function (event, ui) {
        Favorites.add($(this).attr("desktop"));
    });

    $("#remove_from_favorites_button").bind("tap", function (event, ui) {
        Favorites.remove($(this).attr("desktop"));
    });

    $("#remove_from_favorites_button").bind("tap", function (event, ui) {
        Favorites.remove($(this).attr("desktop"));
    });

    $("#settings_button").bind("tap", function (event, ui) {
        Utils.run_command("gnome-control-center");
    });

    $("#logout_button").bind("tap", function (event, ui) {
        sessionManager.logout(); 
    });

    if (sessionManager.canShutdown()) {
        $("#shutdown_button").bind("tap", function (event, ui) {
            sessionManager.shutdown(); 
        });
    } else {
        $("#shutdown_option").hide();
        $("#listGeneral").listview("refresh");
    }
}

function changePage(page) {
    var width = $('.ui-mobile-viewport').width();
    if (typeof width === "undefined") {
        width = 1000;
    }

    var h = page.find("div[data-role='header']");
    if (h.attr("data-add-back-btn") == "true" &&
        h.attr("back-btn-added") != "true") {
        var b = $("<div>", {
            "class": "ui-back-button"
        }).click(function() { changePage($("#first"))});
        h.prepend(b);
        h.attr("back-btn-added", "true");
    }

    page.show();
    page.removeClass("ui-animation-slide");
    var p = activePage; 

    if (p != null) {
        if (page.attr("id") == "first") {
            console.log("going to first");
            // we're coming to first page
            // so the incoming must come from -width 
            page.css("left", "-" + width + "px");
            // and outgoing should come from +width
            p.css("left", width + "px");
        } else {

            console.log("going away from first");
            // we're moving away from first page
            // so the incoming must come from +width
            page.css("left", width + "px");
            // and outgoing (#first) must go to -width
            p.css("left", "-" + width + "px");
        }

    console.log("current page: " + page.css("left") + ": outgoing: "+  p.css("left"));
    }

    page.addClass("ui-animation-slide");
    page.css("left", "0px");
    console.log("-" + width);
    activePage = page;
}


function setupBasicStyle() {
    $('body').addClass("ui-mobile-viewport");
    $('a').addClass("ui-link");
}

function setupAdditionalStyle() {
    $('div[data-role="page"]').addClass("ui-page");
    $('div[data-role="header"]').addClass("ui-header");
    $('div[data-role="content"]').addClass("ui-content");

    refreshStyle('ul[data-role="listview"]');
}

function propagateMouseUp() {
    // simply propagate this to the mouseup handler above
    $(this).find("a").trigger("mouseup");
}

function propagateMouseDown() {
    // simply propagate this to the mousedown handler above
    $(this).find("a").trigger("mousedown");
}

function toggleCollapsible(e) {
    var g = $(this).parent().find(".ui-collapsible-control-group");
    if (g.css('display') == "none") {
        $(this).parent().parent().find(".ui-collapsible-control-group").hide();
        var h = g.height();
        if (h == 0) {
            g.css("height", "inherit");
            h = g.height();
        }
        g.show();
        g.height(h);
    } else {
        g.height(0);
        g.hide();
    }
}

// Refresh styles of the specified jQuery object 
function refreshStyle(e) {
    if (typeof e.attr === "undefined") {
        e = $(e);
    }

    switch (e.attr("data-role")) {
        case "listview":    {
            // Specify the style for listview
            e.addClass("ui-listview");
            // Wrap the button with a listview item
            e.find("a").wrap("<div class=ui-listview-item/>");
            // And rewire the mouse event handling for these items
            $(".ui-listview-item").mousedown(propagateMouseDown);
            $(".ui-listview-item").mouseup(propagateMouseUp);
            break;
        }

        case "collapsible-set": {
            // Specify the style for the control group and
            // the inner collapsibles
            e.find("div[data-role='controlgroup']").addClass("ui-collapsible-control-group");
            e.find("div[data-role='collapsible']").addClass("ui-collapsible");
            // Hide all control group initially
            e.find(".ui-collapsible-control-group").hide();

            var c = e.find(".ui-collapsible");
            // Wrap the button inside collapsible with
            // a listview item
            c.find("a").wrap("<div class=ui-listview-item/>");

            // Find the header inside inner collapsible
            var h = c.find("div[data-role='collapsible-header']");
            // specify the header style to it
            h.addClass("ui-collapsible-header");
            // handle the click event
            h.click(toggleCollapsible);
            // Give different styles for top and bottom items
            h.first().addClass("ui-collapsible-header-top");
            h.last().addClass("ui-collapsible-header-bottom");
            for (var i = 0; i < e.length; i ++) {
                console.log(e[i].outerHTML);
            }
            break;
        }
    }
    setupBasicStyle();
}

function gettext(text) {
    return Utils.translate(text);
}

function translate() {
    $("span[translate!='no']").text(function(index, text) {
        $(this).text(gettext(text));
    });
}
