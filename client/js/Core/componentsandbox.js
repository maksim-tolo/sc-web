/**
 * Sc-addresses dictionary
 * @type {Object}
 */
SCWeb.core.scAddrsDict = {};

/**
 * Create new instance of component sandbox.
 * @class
 * @param {Object} options Options object
 * @param {String} options.container Id of dom object, that will contain component
 * @param {String} options.addr sc-addr of sc-link or sc-structure, that edit or viewed with sandbox
 * @param {Boolean} options.is_struct If that value is true, then addr is a sc-addr to viewed structure; otherwise the last one is a sc-link
 * @param {String} options.format_addr sc-addr of window format
 * @param {Boolean} options.canEdit Represent edit permission
 * @param {Object} options.keynodes Dictionary that contains keynode addr by system identifiers
 */
SCWeb.core.ComponentSandbox = function(options) {
    this.container = options.container;
    this.wrap_selector = '#' + this.container + '_wrap';
    this.addr = parseInt(options.addr);
    this.is_struct = options.is_struct;
    this.format_addr = options.format_addr;
    this.is_editor = options.canEdit;

    this.eventGetObjectsToTranslate = null;
    this.eventApplyTranslation = null;
    this.eventArgumentsUpdate = null;
    this.eventWindowActiveChanged = null;
    this.eventDataAppend = null;
    
    /* function (added, element, arc)
     * - added - true, when element added; false - element removed
     * - element - sc-addr of added(removed) sc-element
     * - arc - sc-addr of arc that connect struct with element
     */
    this.eventStructUpdate = null;  
    
    this.event_add_element = null;
    this.event_remove_element = null;
    
    this.listeners = [];
    this.keynodes = options.keynodes;
    
    var self = this;
    this.listeners = [];
    this.childs = {};

    this.createWindowControls();

    // listen arguments
    this.listeners.push(SCWeb.core.EventManager.subscribe("arguments/add", this, this.onArgumentAppended));
    this.listeners.push(SCWeb.core.EventManager.subscribe("arguments/remove", this, this.onArgumentRemoved));
    this.listeners.push(SCWeb.core.EventManager.subscribe("arguments/clear", this, this.onArgumentCleared));
    
    // listen translation
    this.listeners.push(SCWeb.core.EventManager.subscribe("translation/update", this, this.updateTranslation));
    this.listeners.push(SCWeb.core.EventManager.subscribe("translation/get", this, function(objects) {
        var items = self.getObjectsToTranslate();
        for (var i in items) {
            objects.push(items[i]);
        }
    }));
    
    // listen struct changes
    /// @todo possible need to wait event creation
    if (this.is_struct) {
        window.sctpClient.event_create(SctpEventType.SC_EVENT_ADD_OUTPUT_ARC, this.addr, function(addr, arg) {
            if (self.eventStructUpdate) {
                self.eventStructUpdate(true, addr, arg);
            }
        }).done(function(id) {
            self.event_add_element = id;
        });
        window.sctpClient.event_create(SctpEventType.SC_EVENT_REMOVE_OUTPUT_ARC, this.addr, function(addr, arg) {
            if (self.eventStructUpdate) {
                self.eventStructUpdate(false, addr, arg);
            }
        }).done(function(id) {
            self.event_remove_element = id;
        });
    }
};

// ------------------ Core functions --------------------------
/**
 * Destroys component sandbox
 */
SCWeb.core.ComponentSandbox.prototype.destroy = function() {
    for (var l in this.listeners) {
        SCWeb.core.EventManager.unsubscribe(this.listeners[l]);
    }
    
    /// @todo possible need to wait event destroy
    if (this.event_add_element) {
        window.sctpClient.event_destroy(this.event_add_element);
    }
    if (this.event_remove_element) {
        window.sctpClient.event_destroy(this.event_remove_element);
    }
};

/**
 * Create controls for window
 */
SCWeb.core.ComponentSandbox.prototype.createWindowControls = function() {
    /*var html = '<button type="button" class="button-menu btn btn-default btn-xs" data-toggle="button"><span class="caret"></span></button>\
                <div class="btn-group-vertical btn-group-xs hidden"> \
                    <button type="button" class="btn btn-success"><span class="glyphicon glyphicon-tags"></span></button> \
                </div>';
    var self = this;
    var controls = $(this.wrap_selector + ' > .sc-content-controls');
    controls.append(html).find('.button-menu').on('click', function() {
        controls.find('.btn-group-vertical').toggleClass('hidden');
    });*/
    
};

// ------------------ Functions to call from component --------

/**
 * Get edit permission
 * @returns {Boolean} If that value is true, then request editor creation; otherwise - viewer
 */
SCWeb.core.ComponentSandbox.prototype.canEdit = function() {
    return this.is_editor;
};

/**
 * Get current language
 * @returns {String} Current language
 */
SCWeb.core.ComponentSandbox.prototype.getCurrentLanguage = function() {
    return SCWeb.core.Translation.getCurrentLanguage();
};

/**
 * Do default command
 * @param {Array} args Array of sc-addrs of command arguments.
 */
SCWeb.core.ComponentSandbox.prototype.doDefaultCommand = function(args) {
    SCWeb.core.Main.doDefaultCommand(args);
};

/**
 * Resolves sc-addr for all elements with attribute sc_control_sys_idtf
 * @param {String} parentSelector String that contains selector for parent element.
 */
SCWeb.core.ComponentSandbox.prototype.resolveElementsAddr = function(parentSelector) {
    SCWeb.ui.Core.resolveElementsAddr(parentSelector);
};

/**
 * Generate html for new window container
 * @param {String} containerId ID that will be set to container
 * @param {String} containerClasses Classes that will be added to container
 * @param {String} controlClasses Classes that will be added to control
 * @param {String} addr sc-addr of window
 * @returns {String} String that contains html container
 */
SCWeb.core.ComponentSandbox.prototype.generateWindowContainer = function(containerId, containerClasses, controlClasses, addr) {
    return SCWeb.ui.WindowManager.generateWindowContainer(containerId, containerClasses, controlClasses, addr);
};

/**
 * Get keynode by it system identifier
 * @param {String} sys_idtf System identifier
 * @returns {String|null} If keynodes exist, then returns it sc-addr; otherwise returns null
 */
SCWeb.core.ComponentSandbox.prototype.getKeynode = function(sys_idtf) {
    var res = this.keynodes[sys_idtf];

    return res || null
};

/**
 * Get identifiers
 * @param {Array} addr_list List of addresses
 * @param {Function} callback Callback function
 */
SCWeb.core.ComponentSandbox.prototype.getIdentifiers = function(addr_list, callback) {
    SCWeb.core.Server.resolveIdentifiers(addr_list, callback);
};

/**
 * Get identifier
 * @param {String} addr Address
 * @param {Function} callback Callback function
 */
SCWeb.core.ComponentSandbox.prototype.getIdentifier = function(addr, callback) {
    SCWeb.core.Server.resolveIdentifiers([addr], function(idtfs) {
        callback(idtfs[addr]);
    });
};

/**
 * Get link content
 * @param {String} addr Address
 * @param {Function} callback_success Success callback function
 * @param {Function} callback_error Error callback function
 */
SCWeb.core.ComponentSandbox.prototype.getLinkContent = function(addr, callback_success, callback_error) {
    SCWeb.core.Server.getLinkContent(addr, callback_success, callback_error);
};

/**
 * Resolve addresses
 * @param {Array} idtf_list List of identifiers
 * @param {Function} callback Callback function
 */
SCWeb.core.ComponentSandbox.prototype.resolveAddrs = function(idtf_list, callback) {
    var args = [];
    var result = {};

    for (var idx in idtf_list) {
        var idtf = idtf_list[idx];
        var addr = SCWeb.core.scAddrsDict[idtf];

        if (addr) {
            result[idtf] = addr;
        }
        else {
            args.push(idtf);
        }
    }
    
    SCWeb.core.Server.resolveScAddr(args, function(data) {
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                SCWeb.core.scAddrsDict[key] = data[key];
            }
        }       
        callback(SCWeb.core.scAddrsDict);
    });
};

/**
 * Append childes
 * @param {Object} windows Viewers
 */
SCWeb.core.ComponentSandbox.prototype._appendChilds = function(windows) {
     for (var cntId in windows) {
        if (!windows.hasOwnProperty(cntId)) {
            continue;
        }
        if (this.childs[cntId]) {
            throw "Duplicate child container " + cntId;
        }
        this.childs[cntId] = windows[cntId];
    }
};

/**
 * Create viewers for specified sc-links
 * @param {Object} containers_map Map of viewer containers (key: sc-link addr, value: id of container)
 */
SCWeb.core.ComponentSandbox.prototype.createViewersForScLinks = function(containers_map) {
    var dfd = new jQuery.Deferred();
    var self = this;

    SCWeb.ui.WindowManager.createViewersForScLinks(containers_map).done(function (windows) {
        self._appendChilds(windows);
        dfd.resolve(windows);
    }).fail(dfd.reject.bind(dfd));
    
    return dfd.promise();
};

/**
 * Create viewers for specified sc-structures
 * @param {Object} containers_map Map of viewer containers
 * (id: id of container, value: {key: sc-struct addr, ext_lang_addr: sc-addr of external language}})
 * @returns {Object} Viewers
 */
SCWeb.core.ComponentSandbox.prototype.createViewersForScStructs = function(containers_map) {
    var windows = SCWeb.ui.WindowManager.createViewersForScStructs(containers_map);

    this._appendChilds(windows);

    return windows;
};

/**
 * Function takes content of sc-link or structure from server and call event handlers
 * @param {String} contentType type of content data (@see SctpClient.getLinkContent).
 * If it's null, then data will be returned as string
 */
SCWeb.core.ComponentSandbox.prototype.updateContent = function(contentType) {
    var dfd = new jQuery.Deferred();
    var self = this;

    if (this.is_struct && this.eventStructUpdate) {
        window.sctpClient.iterate_elements(SctpIteratorType.SCTP_ITERATOR_3F_A_A, [
            this.addr,
            sc_type_arc_pos_const_perm,
            0
        ]).done(function (res) {
            for (var idx in res) {
                self.eventStructUpdate(true, res[idx][0], res[idx][1]);
            }

            dfd.resolve();
        });
    }
    else {
        window.sctpClient.get_link_content(this.addr, contentType)
            .done(function(data) {
                $.when(self.onDataAppend(data)).then(dfd.resolve.bind(dfd), dfd.reject.bind(dfd));
            })
            .fail(dfd.reject.bind(dfd));
    }
    
    return dfd.promise();
};

// ------ Translation ---------
/**
 * Get objects to translate
 * Just for internal usage in core.
 * @returns {Array} List of objects, that can be translated.
 */
SCWeb.core.ComponentSandbox.prototype.getObjectsToTranslate = function() {
    return this.eventGetObjectsToTranslate ? this.eventGetObjectsToTranslate() : [];
};

/**
 * Apply translation to component.
 * Just for internal usage in core
 * @param {Object} translation_map Dictionary of translation
 */
SCWeb.core.ComponentSandbox.prototype.updateTranslation = function(translation_map) {
    if (this.eventApplyTranslation) {
        this.eventApplyTranslation(translation_map);
    }
};

// ----- Arguments ------
/**
 * Fire arguments changed.
 */
SCWeb.core.ComponentSandbox.prototype._fireArgumentsChanged = function() {
    if (this.eventArgumentsUpdate) {
        this.eventArgumentsUpdate(SCWeb.core.Arguments._arguments.slice(0));
    }
};

/**
 * Calls when new argument added
 */
SCWeb.core.ComponentSandbox.prototype.onArgumentAppended = function() {
    this._fireArgumentsChanged();
};

/**
 * Calls when new argument removed
 */
SCWeb.core.ComponentSandbox.prototype.onArgumentRemoved = function() {
    this._fireArgumentsChanged();
};

/**
 * Calls when arguments list cleared
 */
SCWeb.core.ComponentSandbox.prototype.onArgumentCleared = function() {
    this._fireArgumentsChanged();
};

// --------- Window -----------
/**
 * Calls when active window changed
 * @param {Boolean} is_active Is active window
 */
SCWeb.core.ComponentSandbox.prototype.onWindowActiveChanged = function(is_active) {
    if (this.eventWindowActiveChanged) {
        this.eventWindowActiveChanged(is_active);
    }
};

// --------- Data -------------
/**
 * Calls when data appended
 * @param {Object} data Data to append
 */
SCWeb.core.ComponentSandbox.prototype.onDataAppend = function(data) {
    var dfd = new jQuery.Deferred();
    var self = this;

    if (this.eventDataAppend) {
        $.when(this.eventDataAppend(data)).then(function() {
            $.when(SCWeb.core.Translation.translate(self.getObjectsToTranslate())).done(function(namesMap) {
                self.updateTranslation(namesMap);
                dfd.resolve();
            });
            //dfd.resolve();
        }, dfd.reject.bind(dfd));
    } else {
        dfd.resolve();
    }

    return dfd.promise();
};
