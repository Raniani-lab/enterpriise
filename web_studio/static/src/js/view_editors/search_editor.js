odoo.define('web_studio.SearchEditor', function (require) {
"use strict";

var core = require('web.core');
var DomainSelectorDialog = require("web.DomainSelectorDialog");
var DomainUtils = require('web.domainUtils');
var FormEditorHook = require('web_studio.FormEditorHook');
var SearchRenderer = require('web_studio.SearchRenderer');
var session = require('web.session');
var utils = require('web_studio.utils');

var _t = core._t;

var SearchEditor = SearchRenderer.extend({
    nearest_hook_tolerance: 50,
    className: SearchRenderer.prototype.className + ' o_web_studio_search_view_editor',
    custom_events: _.extend({}, SearchRenderer.prototype.custom_events, {
        'on_hook_selected': function() {
            this.selected_node_id = false;
        },
    }),
    init: function(parent, arch, fields, state, widgets_registry, options) {
        this._super.apply(this, arguments);
        this.hook_nodes = {};
        this.node_id = 1;
        this.GROUPABLE_TYPES = ['many2one', 'char', 'boolean', 'selection', 'date', 'datetime'];
    },
    _render: function() {
        var result = this._super.apply(this, arguments);
        var self = this;
        this.$('.ui-droppable').droppable({
            accept: ".o_web_studio_component",
            drop: function(event, ui) {
                var $hook = self.$('.o_web_studio_nearest_hook');
                if ($hook.length) {
                    var hook_id = $hook.data('hook_id');
                    var hook = self.hook_nodes[hook_id];
                    var new_attrs = ui.draggable.data('new_attrs');
                    var structure = ui.draggable.data('structure');
                    // Check if a filter component has been dropped
                    if (structure === "filter") {
                        // Create the input for the string here
                        // in order to be able to get the value easily in the event trigger below
                        var $domain_div = $("<div><label>Label:</label></div>");
                        self.$domain_label_input = $("<input type='text' id='domain_label'/>");
                        $domain_div.append(self.$domain_label_input);
                        var domain_dialog = self._openDomainDialog(self.state.model, [["id","=",1]], {
                            readonly: false,
                            debugMode: session.debug,
                            $content: $domain_div,
                        });
                        // Add the node when clicking on the dialog 'save' button
                        domain_dialog.on('domain_selected', self, function (event) {
                            new_attrs = {
                                domain: DomainUtils.domainToString(event.data.domain),
                                string: self.$domain_label_input.val(),
                                name: 'studio_' + structure + '_' + utils.randomString(5),
                            };
                            var values = {
                                type: 'add',
                                structure: structure,
                                node: hook.node,
                                new_attrs: new_attrs,
                                position: hook.position,
                            };
                            this.trigger_up('view_change', values);
                        });
                        $hook.removeClass('o_web_studio_nearest_hook');
                        ui.helper.removeClass('ui-draggable-helper-ready');
                        self.trigger_up('on_hook_selected');
                        return;
                    }
                    // Since the group_by are defined by filter tag inside a group
                    // but the droppable object is a field structure, the structure is overridden
                    if (hook.type === "group_by" && structure === "field") {
                        structure = "filter";
                        if (!new_attrs) {
                            new_attrs = {};
                        }
                        // There is no element 'group' in the view that can be target
                        // to add a group_by filter so we add one before the insertion
                        // of the group_by filter
                        if (!self.first_group_by) {
                            new_attrs.create_group = true;
                        }
                        new_attrs.string = new_attrs.label;
                        new_attrs.context = "{'group_by': '" + new_attrs.name + "'}";
                    }
                    var values = {
                        type: 'add',
                        structure: structure,
                        field_description: ui.draggable.data('field_description'),
                        node: hook.node,
                        new_attrs: new_attrs,
                        position: hook.position,
                    };
                    ui.helper.removeClass('ui-draggable-helper-ready');
                    self.trigger_up('on_hook_selected');
                    self.trigger_up('view_change', values);
                }
            },
        });
        this._add_hook_empty_table();
        return result;
    },
    _add_hook_empty_table: function() {
        var $tbody = this.$('.o_web_studio_search_autocompletion_fields tbody');
        if (!$tbody.children().length) {
            this._add_first_hook($tbody, 'field');
        }
        $tbody = this.$('.o_web_studio_search_filters tbody');
        if (!$tbody.children().length) {
            this._add_first_hook($tbody, 'filter');
        }
        $tbody = this.$('.o_web_studio_search_group_by tbody');
        if (!$tbody.children().length) {
            this._add_first_hook($tbody, 'group_by');
        }
    },
    _add_first_hook: function($parent, type) {
        var node = {
            tag: 'search'
        };
        if (type === "group_by") {
            node = {
                tag: 'group',
            };
        }
        var formEditorHook = this._render_hook(node, 'inside', 'tr', type);
        formEditorHook.appendTo($('<div>')); // start the widget
        $parent.append(formEditorHook.$el);
    },
    _prepare_editable_search_node: function(node, $result, type) {
        var self = this;
        $result.attr('data-node-id', this.node_id++);
        $result.click(function() {
            self.selected_node_id = $result.data('node-id');
            self.trigger_up('node_clicked', {node: node});
        });
        // Add hook after this field
        var formEditorHook = this._render_hook(node, 'after', 'tr', type);
        formEditorHook.appendTo($('<div>')); // start the widget
        $result.after(formEditorHook.$el);
        this._set_style_events($result);
        this._render_hook_before_first_child($result, type);
    },
    // Add hook before the first child of a table
    _add_hook_before_first_child: function($result, first_child, type) {
        var formEditorHook = this._render_hook(first_child, 'before', 'tr', type);
        formEditorHook.appendTo($('<div>')); // start the widget
        $result.before(formEditorHook.$el);
    },
    _render_hook_before_first_child: function($result, type) {
        if (type === 'field' && this.first_field && this.first_field !== 'done') {
            this._add_hook_before_first_child($result, this.first_field, 'field');
            this.first_field = 'done';
        } else if (type === 'filter' && this.first_filter && this.first_filter !== 'done') {
            this._add_hook_before_first_child($result, this.first_filter, 'filter');
            this.first_filter = 'done';
        } else if (type ==='group_by' && this.first_group_by && this.first_group_by !== 'done') {
            this._add_hook_before_first_child($result, this.first_group_by.children[0], 'group_by');
            this.first_group_by = 'done';
        }
    },
    _render_field: function(node) {
        var $result = this._super.apply(this, arguments);
        this._prepare_editable_search_node(node, $result, 'field');
        return $result;
    },
    _render_filter: function(node) {
        var $result = this._super.apply(this, arguments);
        node.attrs.domain = DomainUtils.domainToString(node.attrs.domain);
        this._prepare_editable_search_node(node, $result, 'filter');
        return $result;
    },
    _render_separator: function(node) {
        var $result = this._super.apply(this, arguments);
        this._prepare_editable_search_node(node, $result, 'filter');
        return $result;
    },
    _render_group_by: function(node) {
        node.tag = "filter";
        // attribute used in the template to know if we are clicking on a group_by or a filter
        // since the nodes have the same tag "filter"
        node.attrs.is_group_by = true;
        var $result = this._super.apply(this, arguments);
        this._prepare_editable_search_node(node, $result, 'group_by');
        return $result;
    },
    _render_hook: function(node, position, tag_name, type) {
        var hook_id = _.uniqueId();
        this.hook_nodes[hook_id] = {
            node: node,
            position: position,
            type: type,
        };
        return new FormEditorHook(this, position, hook_id, tag_name);
    },
    _openDomainDialog: function (model, value, option) {
        return new DomainSelectorDialog(this, model, value, option).open();
    },
    highlight_nearest_hook: function($helper, position) {
        this.$('.o_web_studio_nearest_hook').removeClass('o_web_studio_nearest_hook');
        var $nearest_form_hook = this.$('.o_web_studio_hook')
            .touching({
                x: position.pageX - this.nearest_hook_tolerance,
                y: position.pageY - this.nearest_hook_tolerance,
                w: this.nearest_hook_tolerance*2,
                h: this.nearest_hook_tolerance*2})
            .nearest({x: position.pageX, y: position.pageY}).eq(0);
        if ($nearest_form_hook.length) {
            // We check what is being dropped and in which table
            // since in the autocompletion fields and group_by tables
            // we can only drop fields and in the filter table
            // we can only drop filter and separator components.
            var hook_classes = $helper.attr("class");
            var table_type = $nearest_form_hook.closest('table').data('type');
            var accept_fields = ['autocompletion_fields', 'group_by'];
            var is_field_droppable = hook_classes.includes("o_web_studio_field") && _.contains(accept_fields, table_type);
            var is_component_droppable = table_type === 'filters' &&
                (hook_classes.includes("o_web_studio_filter") || hook_classes.includes("o_web_studio_filter_separator"));
            // We check if the field dropped is a groupabble field
            // if dropped in the group_by table
            if (table_type === 'group_by' && is_field_droppable) {
                var ttype = $($helper.context).data('new_attrs').ttype;
                var store = $($helper.context).data('new_attrs').store;
                is_field_droppable =  _.contains(this.GROUPABLE_TYPES, ttype) && store === 'true';
            }
            if (is_field_droppable || is_component_droppable){
                $nearest_form_hook.addClass('o_web_studio_nearest_hook');
                return true;
            }
        }
        return false;
    },

    get_local_state: function() {
        var state = this._super.apply(this, arguments);
        if (this.selected_node_id) {
            state.selected_node_id = this.selected_node_id;
        }
        return state;
    },
    set_local_state: function(state) {
        if (state.selected_node_id) {
            var $selected_node = this.$('[data-node-id="' + state.selected_node_id + '"]');
            if ($selected_node) {
                $selected_node.click();
            }
        }
    }
});

return SearchEditor;

});
