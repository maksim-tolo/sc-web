/**
 * @Class
 * @Description Controls available modes for natural languages (russian, english ant etc.)
 * It can fires next events:
 * * "translation/update" - this event emits on mode changed. Parameter: dictionary, that contains new translation
 * * "translation/get" - this event emits to collect all objects for translate. Parameter: array, that need to be filled by listener
 * * "translation/changed_language" - this event emits, when current language changed. Parameter: sc-addr of current language
 * * "translation/change_language_start" - this event emits on language change start. Parameter: empty
 * (this array couldn't be cleared, listener just append new elements).
 */
SCWeb.core.Translation = {

    /**
     * Listeners
     * @type {Array}
     * @private
     */
    listeners: [],

    /**
     * Current language
     * @private
     */
    current_lang: null,

    /**
     * Updates all translations
     */
    update: function() {
        var dfd = new jQuery.Deferred();

        // collect objects, that need to be translated
        var objects = this.collectObjects();
        
        // @todo need to remove duplicates from object list
        // translate
        var self = this;

        $.when(this.translate(objects)).then(
            function(namesMap) {
                self.fireUpdate(namesMap);
                dfd.resolve();
            },
            function() {
                dfd.reject(); 
            });
        
        return dfd.promise();
    },
    
    getCurrentLanguage: function() {
        return this.current_lang;
    },
    
    /**
     * Do translation routines. Just for internal usage.
     * @param {Array} objects List of sc-addrs, that need to be translated.
     * Key is sc-addr of element and value is identifier.
     * If there are no key in returned object, then identifier wasn't found
     */
    translate: function(objects) {
        var dfd = new jQuery.Deferred();

        SCWeb.core.Server.resolveIdentifiers(objects, function(namesMap) {
            dfd.resolve(namesMap);
        });

        return dfd.promise();
    },
    
    /**
     * Change translation language
     * @param {String} lang_addr sc-addr of language to translate
     * @param {Function} callback Callbcak function that will be called on language change finish
     */
    setLanguage: function(lang_addr, callback) {
        var self = this;

        SCWeb.core.Server.setLanguage(lang_addr, function() {
            self.fireLanguageChanged(lang_addr);
            $.when(self.translate(self.collectObjects())).done(function (namesMap) {
                self.fireUpdate(namesMap);
                callback();
            });
        });
    },
    
    /**
     * Notify listeners for new translations
     * @param {Object} namesMap Names map
     */
    fireUpdate: function(namesMap) {
        SCWeb.core.EventManager.emit("translation/update", namesMap);
    },

    /**
     * Fires translation update event
     * @param {Dict} lang_addr Dictionary that contains translations
     */
    fireLanguageChanged: function(lang_addr) {
        SCWeb.core.EventManager.emit("translation/changed_language", lang_addr);
        this.current_lang = lang_addr;
    },

    /**
     * Collect objects for translation
     * @returns {Array} Collected objects
     */
    collectObjects: function() {
        var arr = [];

        SCWeb.core.EventManager.emit("translation/get", arr);

        return arr;
    },
    
    /**
     * Request to translate objects
     * @param {Array} objects Array of objects to translate
     */
    requestTranslate: function(objects) {
        this.translate(objects).then(this.fireUpdate.bind(this));
    }
    
};
