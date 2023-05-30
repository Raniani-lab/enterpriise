/** @odoo-module alias=web_studio.XMLEditor **/

import AceEditor from "web_editor.ace";

/**
 * Extend the default view editor so that views are saved thanks to web studio and not
 * default RPC. Also notifies studio when the editor is closed.
 */
export default AceEditor.extend({

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    do_hide: function () {
        this.trigger_up("close_xml_editor");
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _isCustomResource(resID) {
        if (this.currentType === "xml") {
            return String(this.views[resID].xml_id).startsWith("studio_customization");
        } else {
            return this._super(...arguments);
        }
    },
    /**
     * @override
     */
    _saveView: function (session) {
        var self = this;
        var view = this.views[session.id];
        var old_arch = view.arch;
        var new_arch = session.text;

        return new Promise(function (resolve, reject) {
            self.trigger_up('save_xml_editor', {
                view_id: session.id,
                old_arch: old_arch,
                new_arch: new_arch,
                on_success: function () {
                    self._toggleDirtyInfo(session.id, "xml", false);
                    view.arch = new_arch;
                    resolve();
                },
                on_fail: reject,
            });
        });
    },
});
