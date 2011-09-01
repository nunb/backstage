/*==================================================
 *  Backstage.ListFacet
 *==================================================
 */

Backstage.ListFacet = function(containerElmt, uiContext, id) {
    this._id = id;
    this._localID = null;
    this._div = containerElmt;
    this._uiContext = uiContext;
    this._expressionString = null;
    this._settings = {};
    
    this._valueSet = new Exhibit.Set();
    this._selectMissing = false;
    
    this._state = {
        values: [],
        count:  0
    };
};

Backstage.ListFacet._settingSpecs = {
    "facetLabel":       { type: "text" },
    "fixedOrder":       { type: "text" },
    "sortMode":         { type: "text", defaultValue: "value" },
    "sortDirection":    { type: "text", defaultValue: "forward" },
    "showMissing":      { type: "boolean", defaultValue: true },
    "missingLabel":     { type: "text" },
    "scroll":           { type: "boolean", defaultValue: true },
    "height":           { type: "text" },
    "colorCoder":       { type: "text", defaultValue: null }
};

Backstage.ListFacet.createFromDOM = function(configElmt, containerElmt, uiContext, id) {
    var configuration = Exhibit.getConfigurationFromDOM(configElmt);
    var uiContext = Backstage.UIContext.createFromDOM(configElmt, uiContext);
    var facet = new Backstage.ListFacet(
        containerElmt != null ? containerElmt : configElmt, 
        uiContext,
        id
    );
    
    Exhibit.SettingsUtilities.collectSettingsFromDOM(configElmt, Exhibit.ListFacet._settingSpecs, facet._settings);
    
    try {
        var expressionString = Exhibit.getAttribute(configElmt, "expression");
        if (expressionString != null && expressionString.length > 0) {
            facet._expressionString = expressionString;
            facet._expression = Exhibit.ExpressionParser.parse(expressionString);
        }
        
        var selection = Exhibit.getAttribute(configElmt, "selection", ";");
        if (selection != null && selection.length > 0) {
            for (var i = 0, s; s = selection[i]; i++) {
                facet._valueSet.add(s);
            }
        }
        
        var selectMissing = Exhibit.getAttribute(configElmt, "selectMissing");
        if (selectMissing != null && selectMissing.length > 0) {
            facet._selectMissing = (selectMissing == "true");
        }
    } catch (e) {
        Exhibit.Debug.exception(e, "ListFacet: Error processing configuration of list facet");
    }
    Backstage.ListFacet._configure(facet, configuration);
    
    facet._initializeUI();
    //uiContext.getCollection().addFacet(facet);
    
    return facet;
};

Backstage.ListFacet._configure = function(facet, configuration) {
    Exhibit.SettingsUtilities.collectSettings(configuration, Backstage.ListFacet._settingSpecs, facet._settings);
    
    if ("expression" in configuration) {
        facet._expressionString = configuration.expression;
        facet._expression = Exhibit.ExpressionParser.parse(configuration.expression);
    }
    if ("selection" in configuration) {
        var selection = configuration.selection;
        for (var i = 0; i < selection.length; i++) {
            facet._valueSet.add(selection[i]);
        }
    }
    if ("selectMissing" in configuration) {
        facet._selectMissing = configuration.selectMissing;
    }
    
    if (!("facetLabel" in facet._settings)) {
        facet._settings.facetLabel = "missing ex:facetLabel";
        if (facet._expression != null && facet._expression.isPath()) {
            var segment = facet._expression.getPath().getLastSegment();
            /*
            var property = facet._uiContext.getDatabase().getProperty(segment.property);
            if (property != null) {
                facet._settings.facetLabel = segment.forward ? property.getLabel() : property.getReverseLabel();
            }
            */
        }
    }
    if ("fixedOrder" in facet._settings) {
        var values = facet._settings.fixedOrder.split(";");
        var orderMap = {};
        for (var i = 0; i < values.length; i++) {
            orderMap[values[i].trim()] = i;
        }
        
        facet._orderMap = orderMap;
    }
    
    if ("colorCoder" in facet._settings) {
        //facet._colorCoder = facet._uiContext.getExhibit().getComponent(facet._settings.colorCoder);
    }

    facet._setLocalID();
    facet._register();
};

Backstage.ListFacet.prototype._register = function() {
    Exhibit.Registry.register(Exhibit.Facet._registryKey, this.getID(), this);
};

Backstage.ListFacet.prototype._unregister = function() {
    Exhibit.Registry.unregister(Exhibit.Facet._registryKey, this.getID());
};

Backstage.ListFacet.prototype.dispose = function() {
    this._unregister();
    this._div.innerHTML = "";

    this._dom = null;

    this._div = null;
    this._uiContext = null;
};

Backstage.ListFacet.prototype._setLocalID = function() {
    this._localID = $(this._div).attr("id");

    // @@@ not very unique
    if (typeof localID === "undefined" || localID === null) {
        this._localID = "facet"
            + "-"
            + this._expressionString
            + "-"
            + this._uiContext.getCollection().getID();
    }
};

Backstage.ListFacet.prototype.getServerID = function() {
    return this._id;
};

Backstage.ListFacet.prototype.getID = function() {
    return this._localID;
};

Backstage.ListFacet.prototype._initializeUI = function() {
    var self = this;
    this._dom = Exhibit.FacetUtilities[this._settings.scroll ? "constructFacetFrame" : "constructFlowingFacetFrame"](
        this,
        this._div,
        this._settings.facetLabel,
        function(evt) { self._clearSelections(); },
        this._uiContext
    );
    
    if ("height" in this._settings && this._settings.scroll) {
        this._dom.valuesContainer.style.height = this._settings.height;
    }
};

Backstage.ListFacet.prototype.hasRestrictions = function() {
    return this._valueSet.size() > 0 || this._selectMissing;
};

Backstage.ListFacet.prototype.getServerSideConfiguration = function() {
    return {
        role:           "facet",
        facetClass:     "List",
        collectionID:   this._uiContext.getCollection().getID(),
        expression:     this._expression.getServerSideConfiguration(),
        selection:      this._valueSet.toArray(),
        selectMissing:  this._selectMissing,
        sortMode:       this._settings.sortMode,
        sortDirection:  this._settings.sortDirection
    };
};

Backstage.ListFacet.prototype.onNewState = function(state) {
    this._state = state;
    this._reconstruct();
};

Backstage.ListFacet.prototype.onUpdate = function(update) {
    //this._reconstruct();
};

Backstage.ListFacet.prototype.clearAllRestrictions = function() {
    var restrictions = { selection: [], selectMissing: false };
    if (this.hasRestrictions()) {
        this._valueSet.visit(function(v) {
            restrictions.selection.push(v);
        });
        restrictions.selectMissing = this._selectMissing;
        
        var self = this;
        var onSuccess = function() {
            self._valueSet = new Exhibit.Set();
            self._selectMissing = false;
        };
        
        var url = Backstage.urlPrefix+".."+window.backstage._sessionPath+"/component/"+this._id;
        console.log("clear PUTting to url: "+url);
        this._uiContext.getBackstage().asyncCall("PUT", url, {}, onSuccess);
    }
    return restrictions;
};

Backstage.ListFacet.prototype.applyRestrictions = function(restrictions) {
    var self = this;
    
    var onSuccess = function() {
        self._valueSet = new Exhibit.Set();
        for (var i = 0; i < restrictions.selection.length; i++) {
            self._valueSet.add(restrictions.selection[i]);
        }
        self._selectMissing = restrictions.selectMissing;
        
        Exhibit.UI.hideBusyIndicator();
    };
    
    Exhibit.UI.showBusyIndicator();
    var url = Backstage.urlPrefix+".."+window.backstage._sessionPath+"/component/"+this._id;
    console.log("apply PUTting to url: "+url);
    this._uiContext.getBackstage().asyncCall(
        "PUT",url,
        { restrictions: restrictions }, 
        onSuccess
    );
};

Backstage.ListFacet.prototype._reconstruct = function() {
    var entries = this._state.values;
    var facetHasSelection = this._state.selectionCount > 0;
    
	var omittedCount = 0;
    var self = this;
    var containerDiv = this._dom.valuesContainer;
    $(containerDiv).hide();
    $(containerDiv).empty();
    
    var constructFacetItemFunction = Exhibit.FacetUtilities[this._settings.scroll ? "constructFacetItem" : "constructFlowingFacetItem"];
    var constructValue = function(entry) {
		if (entry.count == 1 && !entry.selected) {
			omittedCount++;
			return;
		}
		
        var label = "label" in entry ? entry.label : entry.value;
        
        var onSelect = function(evt) {
            self._filter(entry.value, label, false);
            evt.preventDefault();
            evt.stopPropagation();
        };
        var onSelectOnly = function(evt) {
            self._filter(entry.value, label, !(evt.ctrlKey || evt.metaKey));
            evt.preventDefault();
            evt.stopPropagation();
        };
        var elmt = constructFacetItemFunction(
            label, 
            entry.count, 
            null, // color
            entry.selected, 
            facetHasSelection,
            onSelect,
            onSelectOnly,
            self._uiContext
        );

        $(containerDiv).append(elmt);
    };
    
    for (var j = 0; j < entries.length; j++) {
        constructValue(entries[j]);
    }
	
	if (omittedCount > 0) {
		var omittedDiv = $("<div>");
		$(omittedDiv).html("<center>Omitted " + omittedCount + " choices with counts of 1</center>");
        $(containerDiv).append(omittedDiv);
	}
	
    $(containerDiv).show();
    
    this._dom.setSelectionCount(this._state.selectionCount);
};

Backstage.ListFacet.prototype._filter = function(value, label, selectOnly) {
    var self = this;
    var selected, select, deselect;
    
    var oldValues = new Exhibit.Set(this._valueSet);
    var oldSelectMissing = this._selectMissing;
    
    var newValues;
    var newSelectMissing;
    var actionLabel;
    
    var wasSelected;
    var wasOnlyThingSelected;
    
    if (value == null) { // the (missing this field) case
        wasSelected = oldSelectMissing;
        wasOnlyThingSelected = wasSelected && (oldValues.size() == 0);
        
        if (selectOnly) {
            if (oldValues.size() == 0) {
                newSelectMissing = !oldSelectMissing;
            } else {
                newSelectMissing = true;
            }
            newValues = new Exhibit.Set();
        } else {
            newSelectMissing = !oldSelectMissing;
            newValues = new Exhibit.Set(oldValues);
        }
    } else {
        wasSelected = oldValues.contains(value);
        wasOnlyThingSelected = wasSelected && (oldValues.size() == 1) && !oldSelectMissing;
        
        if (selectOnly) {
            newSelectMissing = false;
            newValues = new Exhibit.Set();
            
            if (!oldValues.contains(value)) {
                newValues.add(value);
            } else if (oldValues.size() > 1 || oldSelectMissing) {
                newValues.add(value);
            }
        } else {
            newSelectMissing = oldSelectMissing;
            newValues = new Exhibit.Set(oldValues);
            if (newValues.contains(value)) {
                newValues.remove(value);
            } else {
                newValues.add(value);
            }
        }
    }
    
    var newRestrictions = { selection: newValues.toArray(), selectMissing: newSelectMissing };
    var oldRestrictions = { selection: oldValues.toArray(), selectMissing: oldSelectMissing };

    Exhibit.History.pushComponentState(
        this,
        Exhibit.Facet._registryKey,
        newRestrictions,
        (selectOnly && !wasOnlyThingSelected) ?
            String.substitute(
                Exhibit.FacetUtilities.l10n["facetSelectOnlyActionTitle"],
                [ label, this._settings.facetLabel ]) :
            String.substitute(
                Exhibit.FacetUtilities.l10n[wasSelected ? "facetUnselectActionTitle" : "facetSelectActionTitle"],
                [ label, this._settings.facetLabel ]),
        true
    );
};

Backstage.ListFacet.prototype._clearSelections = function() {
    var state = {
        "selection": [],
        "selectMissing": false
    };
    var self = this;
    Exhibit.History.pushComponentState(
        this,
        Exhibit.Facet._registryKey,
        state,
        String.substitute(
            Exhibit.FacetUtilities.l10n["facetClearSelectionsActionTitle"],
            [ this._settings.facetLabel ])
    );
};

Backstage.ListFacet.prototype.exportState = function() {
    var s = this._valueSet.toArray();
    return {
        "selection": s,
        "selectMissing": this._selectMissing
    };
};

Backstage.ListFacet.prototype.importState = function(state) {
    if (state.selection.length === 0 && !state.selectMissing) {
        this.clearAllRestrictions();
    } else {
        this.applyRestrictions(state);
    }
};
