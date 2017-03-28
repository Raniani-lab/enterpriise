odoo.define('web_studio.ActionEditor', function (require) {
"use strict";


var Widget = require('web.Widget');

var ActionEditorSidebar = require('web_studio.ActionEditorSidebar');
var ActionEditorView = require('web_studio.ActionEditorView');
var VIEW_TYPES = ['form', 'search', 'list', 'kanban', 'grid', 'graph', 'pivot', 'calendar', 'gantt'];

var ActionEditor = Widget.extend({
    template: 'web_studio.ActionEditor',
    custom_events: {
        'open_action_form': 'open_action_form',
    },
    init: function (parent, action, active_view_types) {
        this._super.apply(this, arguments);

        this.action = action;
        this.active_view_types = active_view_types;
        this.default_view = active_view_types[0];
    },
    start: function () {
        var self = this;

        // order view_types: put active ones at the begining
        var ordered_view_types = this.active_view_types.slice();
        _.each(VIEW_TYPES, function(el) {
            if (! _.contains(ordered_view_types, el)) {
                ordered_view_types.push(el);
            }
        });


        _.each(ordered_view_types, function(view_type) {
            var is_default_view = (view_type === self.default_view);
            var view = new ActionEditorView(self, {
                active: view_type === 'search' || _.contains(self.active_view_types, view_type),  // search is always active
                default_view: is_default_view,
                type: view_type,
                can_default: !_.contains(['form', 'search'], view_type),
                can_set_another: true,
                can_be_disabled: view_type !== 'search',
            });
            if (_.contains(['form', 'search'], view_type)) {
                view.appendTo(self.$('.o_web_studio_view_category[name="general"]'));
            } else if (_.contains(['list', 'kanban', 'grid'], view_type)) {
                view.appendTo(self.$('.o_web_studio_view_category[name="multiple"]'));
            } else if (_.contains(['graph', 'pivot'], view_type)) {
                view.appendTo(self.$('.o_web_studio_view_category[name="reporting"]'));
            } else if (_.contains(['calendar', 'gantt'], view_type)) {
                view.appendTo(self.$('.o_web_studio_view_category[name="timeline"]'));
            }
        });

        this.sidebar = new ActionEditorSidebar(this, this.action);
        return this.sidebar.prependTo(this.$el);
    },
    open_action_form: function() {
        var options = {
            keep_state: true,
        };
        this.do_action({
            type: 'ir.actions.act_window',
            res_model: 'ir.actions.act_window',
            res_id: this.action.id,
            views: [[false, 'form']],
            target: 'current',
        }, options);
    },
});

return ActionEditor;

});
