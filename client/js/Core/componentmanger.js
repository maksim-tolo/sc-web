/**
 * Component type map
 * @type {Object}
 */
SCWeb.core.ComponentType = {
    viewer: 0,
    editor: 1
};

/**
 * @Class
 */
SCWeb.core.ComponentManager = {

    /**
     * Listener
     * @private
     */
    _listener: null,

    /**
     * Initialize queue
     * @type {Array}
     * @private
     */
    _initialize_queue: [],

    /**
     * Component count
     * @type {Number}
     * @private
     */
    _componentCount: 0,

    /**
     * Factories format
     * @type {Object}
     * @private
     */
    _factories_fmt: {},

    /**
     * Factories of external languages
     * @type {Object}
     * @private
     */
    _factories_ext_lang: {},

    /**
     * External languages
     * @type {Object}
     * @private
     */
    _ext_langs: {},

    /**
     * Array of keynodes that requested by components
     * @type {Array}
     * @private
     */
    _keynodes: [],
    
    init: function() {
        var self = this;
        var dfd = new jQuery.Deferred(); // deffered will be resolved when all component will be registered
        var keynodes = []; // first of all we need to resolve sc-addrs of keynodes

        this._componentCount = this._initialize_queue.length;

        this._initialize_queue.forEach(function(element) {
            keynodes = keynodes.concat(element.formats);
            if (element.getRequestKeynodes) {
                keynodes = keynodes.concat(element.getRequestKeynodes());
            }
            if (keynodes.ext_lang) {
                keynodes.push(element.ext_lang);
            }
        });

        SCWeb.core.Server.resolveScAddr(keynodes, function(addrs) {
            self._keynodes = addrs;

            self._initialize_queue.forEach(function(comp_def) {
                var lang_addr = addrs[comp_def.ext_lang];
                var formats = [];

                if (lang_addr) {
                    self._factories_ext_lang[lang_addr] = comp_def;
                }

                comp_def.formats.forEach(function(element) {
                    var fmt = addrs[element];

                    if (fmt) {
                        self.registerFactory(fmt, comp_def);
                        if (lang_addr) {
                            formats.push(fmt);
                        }
                    }
                });

                if (lang_addr) {
                    self._ext_langs[lang_addr] = formats;
                }
            });
            
            dfd.resolve();
        });

        return dfd.promise();
    },
    
    /**
     * Append new component initialize function
     * @param {Object} component_def Object that define component. It contains such properties as:
     * @param {Array} component_def.formats Formats of system identifiers of supported formats
     * @param {Function} component_def.factory - Factory function (@see SCWeb.core.ComponentManager.registerFactory)
     */
    appendComponentInitialize: function(component_def) {
        this._initialize_queue.push(component_def);
    },
    
    /**
     * Register new component factory
     * @param {Array} format_addr sc-addr of supported format
     * @param {Function} func Function that will called on instance reation. If component instance created, then returns true; otherwise returns false.
     * This function takes just one parameter:
     * * sandbox - component sandbox object, that will be used to communicate with component instance
     */
    registerFactory: function(format_addr, func) {
        this._factories_fmt[format_addr] = func;
    },
    
    /**
     * Check if component for specified format supports structures
     * @param {Array} format_addr sc-addr of supported format
     */
    isStructSupported: function(format_addr) {
        var comp_def = this._factories_fmt[format_addr];

        if (!comp_def) {
            throw "There are no component that supports format: " + format_addr;
        }
        
        return comp_def.struct_support;
    },
    
    /**
     * Create new instance of component window by format
     * @param {Object} options Object that contains creation options:
     *
     * @param {String} options.format_addr Sc-addr of window format
     * @param {Number} options.addr Sc-addr of sc-link or sc-structure, that edit or viewed with sandbox
     * @param {Boolean} options.is_struct If that paramater is true, then addr is an sc-addr of struct;
     *                                    otherwise the last one a sc-addr of sc-link
     * @param {String} options.container Id of dom object, that will contain window
     * @param {Boolean} options.canEdit If that value is true, then request editor creation; otherwise - viewer
     */
    createWindowSandboxByFormat: function(options) {
        var dfd = new jQuery.Deferred();
        var comp_def = this._factories_fmt[options.format_addr];
        
        if (comp_def) {
            var sandbox = new SCWeb.core.ComponentSandbox({
                container: options.container,
                addr: options.addr,
                is_struct: options.is_struct,
                format_addr: options.format_addr, 
                keynodes: this._keynodes,
                canEdit: options.canEdit
            });

            if (!comp_def.struct_support && options.is_struct) {
                throw "Component doesn't support structures: " + comp_def;
            }
            
            if (comp_def.factory(sandbox)) {
                dfd.resolve(sandbox);
            } else {
                throw "Can't create viewer properly"
            }
        } else {        
            dfd.reject();
        }

        return dfd.promise();
    },
    
    /**
     * Create new instance of component window by ext lang
     * @param {Object} options Object that contains creation options:
     *
     * @param {String} options.ext_lang_addr Sc-addr of window external language
     * @param {Number} options.addr Sc-addr of sc-link or sc-structure, that edit or viewed with sandbox
     * @param {Boolean} options.is_struct If that paramater is true, then addr is an sc-addr of struct;
     *                                    otherwise the last one a sc-addr of sc-link
     * @param {String} options.container Id of dom object, that will contain window
     * @param {Boolean} options.canEdit If that value is true, then request editor creation; otherwise - viewer
     * @return {Object|null} Component sandbox object for created window instance.
     * If window doesn't created, then returns null
     */
    createWindowSandboxByExtLang: function(options) {
        var comp_def = this._factories_ext_lang[options.ext_lang_addr];
        
        if (comp_def) {
            var sandbox = new SCWeb.core.ComponentSandbox({
                container: options.container,
                addr: options.addr,
                is_struct: options.is_struct,
                format_addr: null,
                keynodes: this._keynodes,
                canEdit: options.canEdit
            });
            if (!comp_def.struct_support && options.is_struct) {
                throw "Component doesn't support structures: " + comp_def;
            }
            
            if (comp_def.factory(sandbox)) {
                return sandbox;
            } else {
                throw "Can't create viewer properly"
            }
        }

        return null;
    },

    /**
     * Returns sc-addr of primary used format for specified external language
     * @param {String} ext_lang_addr sc-addr of external language
     * @return {String} sc-addr of primary used format for specified external language.
     */
    getPrimaryFormatForExtLang: function(ext_lang_addr) {
        var fmts = this._ext_langs[ext_lang_addr];

        if (fmts && fmts.length > 0) {
            return fmts[0];
        }

        return null;
    },

    /**
     * Returns list of external languages, that has components for sc-structure visualization
     * @return {Array} List of external languages.
     */
    getScStructSupportExtLangs: function() {
        var res = [];
        
        for (var ext_lang in this._factories_ext_lang) {
            if (this._factories_ext_lang.hasOwnProperty(ext_lang)) {
                if (this._factories_ext_lang[ext_lang].struct_support)
                    res.push(ext_lang);
            }
        }
        
        return res;
    },
    
    /**
     * Setup component listener
     * @param {Object} listener Listener object. It must to has functions:
     * @param {Function} listener.onComponentRegistered Function, that call when new component registered. It receive
     * component description object as argument
     * @param {Function} listener.onComponentUnregistered Function, that calls after one of the component was unregistered.
     * It receive component description object as argument
     */
    setListener: function(listener) {
        this._listener = listener;
    },
    
    /**
     * Fires event when new component registered
     * @private
     * @param {Object} compDescr Component descriptor
     */
    _fireComponentRegistered: function(compDescr) {
        if (this._listener) {
            this._listener.componentRegistered(compDescr);
        }
    },
    
    /**
     * Fires event when any of components unregistered
     * @private
     * @param {Object} compDescr Component descriptor
     */
    _fireComponentUnregistered: function(compDescr) {
        if (this._listener) {
            this._listener.componentUnregistered(compDescr);
        }
    }
};
