/** @odoo-module alias=web_studio.AbstractReportComponent **/

import Widget from "web.Widget";

var AbstractReportComponent = Widget.extend({
    /**
     * @override
     * @param {Widget} parent
     * @param {Object} params
     * @param {Object} params.models
     */
    init: function (parent, params) {
        this.models = params.models;
        this.node = {
            context: {},
            contextOrder: [],
        };
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    /**
     * Given a node of the DOM of the report preview, get the avaiable context of this node
     * The context is filled in the branding on the node itself. It represents
     * all the variables available at a moment in the report
     *
     * @param {Object} node
     */
    _getContextKeys: function (node) {
        var self = this;
        var contextOrder = node.contextOrder || [];

        var keys = Object.entries(node.context || {})
            .map(([key, relation]) => {
                if (!self.models[relation]) {
                    return {
                        name: key,
                        string: key + ' (' + relation + ')',
                        type: relation,
                        store: true,
                        related: true,
                        searchable: true,
                        order: -contextOrder.indexOf(key),
                    };
                }
                return {
                    name: key,
                    string: key + ' (' + self.models[relation] + ')',
                    relation: relation,
                    type: key[key.length-1] === 's' ? 'one2many' : 'many2one',
                    store: true,
                    related: true,
                    searchable: true,
                    order: -contextOrder.indexOf(key),
                };
            })
            .filter((x) => !!x);
        keys.sort(function (a, b) {
            return a.order - b.order;
        });
        return keys;
    },
});

export default AbstractReportComponent;
