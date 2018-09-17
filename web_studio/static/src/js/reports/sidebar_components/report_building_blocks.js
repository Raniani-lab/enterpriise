odoo.define('web_studio.reportNewComponents', function (require) {
"use strict";

var core = require('web.core');
var config = require('web.config');
var Dialog = require('web.Dialog');
var weWidgets = require('web_editor.widget');

var Abstract = require('web_studio.AbstractReportComponent');
var NewFieldDialog = require('web_studio.NewFieldDialog');

var _t = core._t;
var _lt = core._lt;

var AbstractNewComponent = Abstract.extend({
    type: false,
    structure: false,
    label: false,
    fa: false,
    description: false,
    /**
     * @override
     */
    start: function () {
        var self = this;
        this.$el.addClass('o_web_studio_component');
        this.$el.text(this.label);
        if (this.fa) {
            this.$el.append('<i class="fa ' + this.fa + '">');
        }
        if (config.debug && this.description) {
            this.$el.addClass('o_web_studio_debug');
            this.$el.append($('<div>')
                .addClass('o_web_studio_component_description')
                .text(this.description)
            );
        }
        this.$el.draggable({
            helper: 'clone',
            opacity: 0.4,
            scroll: false,
            // revert: 'invalid',  // this causes _setTimeout in tests for stop
            revertDuration: 200,
            refreshPositions: true,
            iframeFix: true,
            start: function (e, ui) {
                $(ui.helper).addClass("ui-draggable-helper");
                self.trigger_up('begin_drag_component', {
                    widget: self
                });
            },
            drag: _.throttle(function (e) {
                self.trigger_up('drag_component', {
                    position: {pageX: e.pageX, pageY: e.pageY},
                    widget: self,
                });
            }, 100),
            stop: function (e) {
                self.trigger_up('drop_component', {
                    position: {pageX: e.pageX, pageY: e.pageY},
                    widget: self,
                });
            }
        });

        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * To be overriden.
     *
     * @param {Object} options
     * @param {Object[]} options.targets
     * @param {Integer} [options.oeIndex]
     * @returns {Deferred<Object>}
     */
    add: function (options) {
        this.targets = options.targets;
        var first = options.targets[0];
        this.index = first.data.oeIndex;
        this.position = first.data.oePosition;
        this.node = first.node;
        return $.when({
            type: this.type,
            options: {
                columns: this.dropColumns,
                index: first.data.oeIndex,
            },
        });
    },
    /**
     * create td and th in table, manage colspan.
     *
     * @param {Object} options
     * @param {string} options.head
     * @param {string} options.headLoop
     * @param {string} options.body
     * @param {string} options.bodyLoop
     * @param {string} options.foot
     * @param {string} options.footLoop
     * @returns {Object}
     */
    _createReportTableColumn: function (options) {
        var self = this;
        var inheritance = [];
        var updatedNodes = [];

        // add cells in rows

        _.each(this.targets, function (target) {
            var node = target.node;
            if (node.tag === 'th' || node.tag === 'td') {
                var loop = node.parent.attrs['t-foreach'] || (node.parent.parent.tag === 't' && node.parent.parent.attrs['t-foreach']);
                var dataName = loop ? 'Loop' : '';
                var content = '<' + node.tag + '>';
                if (node.tag === 'th' || node.parent.parent.tag === 'thead') {
                    content += options['head' + dataName] || options.head || '';
                } else if (node.parent.parent.tag === 'tfoot') {
                    content += options['foot' + dataName] || options.foot || '';
                } else {
                    content += options['body' + dataName] || options.body || '';
                }
                content += '</' + node.tag + '>';

                updatedNodes.push(node);
                inheritance.push({
                    content: content,
                    position: target.position,
                    xpath: node.attrs['data-oe-xpath'],
                    view_id: +node.attrs['data-oe-id'],
                });
            } else if (node.tag === 'tr') {
                updatedNodes.push(node);
                inheritance.push({
                    content: '<td>' + (options.tbody || '') + '</td>',
                    position: target.position,
                    xpath: node.attrs['data-oe-xpath'],
                    view_id: +node.attrs['data-oe-id'],
                });
            }
        });

            // colspan
        var cellsToGrow = [];
        _.each(this.targets, function (target) {
            var node = target.node;
            if (target.position !== 'after') {
                return;
            }

            // define td index

            var nodeIndex = 0;
            var nodeRow = self._getParentNode(node, function (node) {return node.tag === 'tr';});
            var cells = self._getChildrenNode(nodeRow, function (node) {return node.tag === 'td' || node.tag === 'th';});
            for (var k = 0; k < cells.length; k++) {
                nodeIndex += +(cells[k].attrs.colspan || 1);
                if (cells[k] === node) {
                    break;
                }
            }

            // select colspan to grow

            var table = self._getParentNode(node, function (node) {return node.tag === 'table';});
            var rows = self._getChildrenNode(table, function (node) {return node.tag === 'tr';});
            _.each(rows, function (row) {
                if (row === nodeRow) {
                    return;
                }

                var cells = self._getChildrenNode(row, function (node) {return node.tag === 'td' || node.tag === 'th';});

                var cellIndex = 0;
                for (var k = 0; k < cells.length; k++) {
                    var cell = cells[k];
                    cellIndex += +(cell.attrs.colspan || 1);
                    if (cellIndex >= nodeIndex) {
                        if (((+cell.attrs.colspan) > 1) && cellsToGrow.indexOf(cell) === -1) {
                            cellsToGrow.push(cell);
                        }
                        break;
                    }
                }
            });
        });
        _.each(cellsToGrow, function (node) {
            inheritance.push({
                content: '<attribute name="colspan">' + ((+node.attrs.colspan) + 1) + '</attribute>',
                position: 'attributes',
                xpath: node.attrs['data-oe-xpath'],
                view_id: +node.attrs['data-oe-id'],
            });
        });

        return inheritance;
    },
    _createStructure: function (options) {
        var xml = ['<div class="row">'];
        for (var k = 0; k < this.dropColumns.length; k++) {
            var column = this.dropColumns[k];
            xml.push('<div class="col-');
            xml.push(column[1]);
            if (column[0]) {
                xml.push(' offset-');
                xml.push(column[0]);
            }
            xml.push('">');
            if (options.content && k === options.index) {
                xml.push(options.content);
            }
            xml.push('</div>');
        }
        xml.push('</div>');

        return [{
            content: xml.join(''),
            position: this.position,
            xpath: this.node.attrs['data-oe-xpath'],
            view_id: +this.node.attrs['data-oe-id'],
        }];
    },
    _createContent: function (options) {
        if (this.dropColumns && typeof this.index === 'number') {
            return this._createStructure({
                index: this.index,
                content: options.contentInStructure || options.content,
            });
        } else {
            return _.map(this.targets, function (target) {
                var isCol = (target.node.attrs.class || '').match(/(^|\s)(col(-[0-9]+)?)(\s|$)/);
                return {
                    content: isCol ? options.contentInStructure || options.content : options.content,
                    position: target.position,
                    xpath: target.node.attrs['data-oe-xpath'],
                    view_id: +target.node.attrs['data-oe-id'],
                };
            });
        }
    },
    _getParentNode: function (node, fn) {
        while (node) {
            if (fn(node)) {
                return node;
            }
            node = node.parent;
        }
    },
    /**
     * TODO: rewrite this function
     */
    _getChildrenNode: function (parent, fn) {
        var children = [];
        var stack = [parent];
        parent = stack.shift();
        while (parent) {
            if (parent.children) {
                for (var k = 0; k < parent.children.length; k++) {
                    var node = parent.children[k];
                    if (fn(node)) {
                        children.push(node);
                    }
                }
                stack = parent.children.concat(stack);
            }
            parent = stack.shift();
        }
        return children;
    },
});

var BuildingTextComponent = AbstractNewComponent.extend({
    type: 'text',
    label: _lt('Text'),
    dropIn: '.row > div, td, th, p',
    className: 'o_web_studio_field_char',
    hookClass: 'o_web_studio_hook_inline',
    hookAutoHeight: true,
    hookTag: 'span',
    dropColumns: [[0, 3], [0, 3], [0, 3], [0, 3]],
    add: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            return $.when({
                inheritance: self._createContent({
                    content: '<span>New Text Block</span>',
                })
            });
        });
    },
});

var BuildingFieldComponent = AbstractNewComponent.extend({
    type: 'field',
    label: _lt('Field'),
    className: 'o_web_studio_field_many2one',
    hookAutoHeight: false,
    hookClass: 'o_web_studio_hook_field',
    dropColumns: [[0, 3], [0, 3], [0, 3], [0, 3]],
    dropIn: 'table tr, .row > div, td, th',
    add: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            var def = $.Deferred();
            var field = {
                order: 'order',
                type: 'related',
                filters: {searchable: false},
            };

            var target = self.targets[0];
            if (self.targets.length > 1 && (target.node.tag === 'td' || target.node.tag === 'th')) {
                target = _.find(self.targets, function (target) {
                    return target.node.tag === "td" && target.node.parent.attrs["t-foreach"];
                }) || target;
            }

            var availableKeys = _.filter(self._getContextKeys(target.node), function (field) {return !!field.relation;});
            var dialog = new NewFieldDialog(self, 'record_fake_model', field, availableKeys).open();
            dialog.on('field_default_values_saved', self, function (values) {
                if (!_.contains(values.related, '.')) {
                    Dialog.alert(self, _t('Please specify a field name for the selected model.'));
                    return;
                }
                def.resolve({
                    inheritance: self._dataInheritance(values),
                });
                dialog.close();
            });
            dialog.on('closed', self, function () {
                def.reject();
            });
            return def;
        });
    },
    _dataInheritance: function (values) {
        var $field = $('<span/>').attr('t-field', values.related);
        if (values.type === 'binary') {
             $field.attr('t-options-widget', '"image"');
        }
        var fieldHTML = $field.prop('outerHTML');
        if (this.node.tag === 'td' || this.node.tag === 'th') {
            return  this._createReportTableColumn({
                head: $('<span/>').text(values.string).prop('outerHTML'),
                bodyLoop: fieldHTML,
            });
        } else {
            return this._createContent({
                contentInStructure: '<span><strong>' + values.string + ':</strong><br/></span>' + fieldHTML,
                content: fieldHTML,
            });
        }
    },
});

var BuildingImageComponent = AbstractNewComponent.extend({
    type: 'image',
    label: _lt('Image'),
    dropIn: 'div[class*=col-], td, th, p',
    className: 'o_web_studio_field_picture',
    hookClass: 'o_web_studio_hook_inline',
    hookAutoHeight: true,
    hookTag: 'span',
    dropColumns: [[0, 3], [0, 3], [0, 3], [0, 3]],
    add: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            var def = $.Deferred();
            var $image = $("<img/>");
            var dialog = new weWidgets.MediaDialog(self, {onlyImages: true},
                $image, $image[0]);
            var value;
            dialog.on("save", self, function (event) {
                value = event.src;
            });
            dialog.on('closed', self, function () {
                if (value) {
                    def.resolve({
                        inheritance: self._createContent({
                            content: '<img class="img-fluid" src="' + value + '"/>',
                        })
                    });
                } else {
                    return def.reject();
                }
            });
            dialog.open();
            return def;
        });
    },
});

var BuildingBlockTitle = AbstractNewComponent.extend({
    type: 'block_title',
    label: _lt('Title Block'),
    className: 'o_web_studio_field_char',
    dropIn: '.page',
    add: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            return $.when({
                inheritance: [{
                    content: '<div class="row"><div class="col h2"><span>New Title</span></div></div>',
                    position: self.position,
                    xpath: self.node.attrs['data-oe-xpath'],
                    view_id: +self.node.attrs['data-oe-id'],
                }],
            });
        });
    },
});

var BuildingBlockAddress = AbstractNewComponent.extend({
    type: 'block_address',
    label: _lt('Address Block'),
    fa: 'fa-address-card',
    className: 'o_web_studio_field_fa',
    hookAutoHeight: false,
    hookClass: 'o_web_studio_hook_address',
    dropColumns: [[0, 5], [2, 5]],
    add: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            var def = $.Deferred();
            var field = {
                order: 'order',
                type: 'related',
                filters: {},
                filter: function (field) {
                    return field.type === 'many2one';
                },
                followRelations: function (field) {
                    return field.type === 'many2one' && field.relation !== 'res.partner';
                },
            };
            var availableKeys = self._getContextKeys(self.node);
            // TODO: maybe filter keys to only get many2one fields to res.partner?
            var dialog = new NewFieldDialog(self, 'record_fake_model', field, availableKeys).open();
            dialog.on('field_default_values_saved', self, function (values) {
                if (!_.contains(values.related, '.')) {
                    Dialog.alert(self, _t('Please specify a field name for the selected model.'));
                    return;
                }
                if (values.relation === 'res.partner') {
                    def.resolve({
                        inheritance: self._createContent({
                            content: '<div t-field="' + values.related + '" t-options-widget="\'contact\'"/>',
                        })
                    });
                    dialog.close();
                } else {
                    Dialog.alert(self, _t('You can only display a user or a partner'));
                }
            });
            dialog.on('closed', self, function () {
                def.reject();
            });
            return def;
        });
    },
});

var BuildingBlockTable = AbstractNewComponent.extend({
    type: 'block_table',
    label: _lt('Data table'),
    fa: 'fa-th-list',
    className: 'o_web_studio_field_fa',
    dropIn: '.page',
    add: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            var def = $.Deferred();
            var field = {
                order: 'order',
                type: 'related',
                filters: {},
                filter: function (field) {
                    return field.type === 'many2one' || field.type === 'one2many' || field.type === 'many2many';
                },
                followRelations: function (field) {
                    return field.type === 'many2one';
                },
            };
            var availableKeys = self._getContextKeys(self.node);
            var dialog = new NewFieldDialog(self, 'record_fake_model', field, availableKeys).open();
            dialog.on('field_default_values_saved', self, function (values) {
                if (values.type === 'one2many' || values.type === 'many2many') {
                    def.resolve({
                        inheritance: self._dataInheritance(values),
                    });
                    dialog.close();
                } else {
                    Dialog.alert(self, _t('You need to use a many2many or one2many field to display a list of items'));
                }
            });
            dialog.on('closed', self, function () {
                def.reject();
            });
            return def;
        });
    },
    _dataInheritance: function (values) {
        var target = this.targets[0];
        return [{
            content:
                '<table class="table table-sm o_report_block_table">' +
                    '<thead>' +
                        '<tr>' +
                            '<th><span>Name</span></th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tbody>' +
                        '<tr t-foreach="' + values.related + '" t-as="table_line">' +
                            '<td><span t-field="table_line.display_name"/></td>' +
                        '</tr>' +
                    '</tbody>' +
                '</table>',
            position: target.position,
            xpath: target.node.attrs['data-oe-xpath'],
            view_id: +target.node.attrs['data-oe-id'],
        }];
    },
});

var BuildingBlockTotal = AbstractNewComponent.extend({
    type: 'block_total',
    label: _lt('Accounting Total'),
    fa: 'fa-money',
    className: 'o_web_studio_field_fa',
    dropIn: '.page',
    hookClass: 'o_web_studio_hook_total',
    dropColumns: [[0, 5], [2, 5]],
    add: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            var def = $.Deferred();
            var field = {
                order: 'order',
                type: 'related',
                filters: {},
                filter: function (field) {
                    return field.type === 'many2one';
                },
                followRelations: function (field) {
                    return field.type === 'many2one' &&
                        field.relation !== 'account.invoice' && field.relation !== 'sale.order';
                },
            };
            var availableKeys = self._getContextKeys(self.node);
            var dialog = new NewFieldDialog(self, 'record_fake_model', field, availableKeys).open();
            dialog.on('field_default_values_saved', self, function (values) {
                def.resolve({
                    inheritance: self._dataInheritance(values),
                });
                dialog.close();
            });
            dialog.on('closed', self, function () {
                def.reject();
            });
            return def;
        });
    },
    _dataInheritance: function (values) {
        var data = this._dataInheritanceValues(values);
        return this._createContent({
            contentInStructure:
                '<table class="table table-sm o_report_block_total">' +
                    '<t t-set="total_currency_id" t-value="' + data.currency_id + '"/>' +
                    '<t t-set="total_amount_total" t-value="' + data.amount_total + '"/>' +
                    '<t t-set="total_amount_untaxed" t-value="' + data.amount_untaxed + '"/>' +
                    '<t t-set="total_amount_by_groups" t-value="' + data.amount_by_groups + '"/>' +
                    '<tr t-if="total_amount_untaxed != total_amount_total">' +
                        '<th>Subtotal</th>' +
                        '<td colspan="2" class="text-right">' +
                            '<span t-esc="total_amount_untaxed" t-options="{\'widget\': \'monetary\', \'display_currency\': total_currency_id}"/>' +
                        '</td>' +
                    '</tr>' +
                    '<t t-foreach="total_amount_by_groups" t-as="total_amount_by_group">' +
                        '<tr>' +
                            '<th><span t-esc="total_amount_by_group[0]"/></th>' +
                            '<td><small t-if="len(total_amount_by_group) > 4 and total_amount_by_group[2] and total_amount_untaxed != total_amount_by_group[2]">on <span t-esc="total_amount_by_group[4]"/></small></td>' +
                            '<td class="text-right">' +
                                '<span t-esc="total_amount_by_group[3]"/>' +
                            '</td>' +
                        '</tr>' +
                    '</t>' +
                    '<t t-if="total_amount_by_groups is None and total_amount_total != total_amount_untaxed">' +
                        '<tr>' +
                            '<th>Taxes</th>' +
                            '<td></td>' +
                            '<td class="text-right">' +
                                '<span t-esc="total_amount_total - total_amount_untaxed" t-options="{\'widget\': \'monetary\', \'display_currency\': total_currency_id}"/>' +
                            '</td>' +
                        '</tr>' +
                    '</t>' +
                    '<tr class="border-black">' +
                        '<th>Total</th>' +
                        '<td colspan="2" class="text-right">' +
                            '<span t-esc="total_amount_total" t-options="{\'widget\': \'monetary\', \'display_currency\': total_currency_id}"/>' +
                        '</td>' +
                    '</tr>' +
                '</table>',
        });
    },
    _dataInheritanceValues: function (values) {
        var currency_id = values.related.split('.')[0] + ".env['res.currency']";
        var amount_untaxed = '0.0';
        var amount_total = '0.0';
        var amount_by_groups = 'None';
        if (values.relation === 'account.invoice'){
            currency_id = values.related + '.currency_id';
        }
        if (values.relation === 'sale.order') {
            currency_id = values.related + '.pricelist_id.currency_id';
        }
        if (values.relation === 'account.invoice' || values.relation === 'sale.order') {
            amount_untaxed = values.related + '.amount_untaxed';
            amount_by_groups = values.related + '.amount_by_group';
            amount_total = values.related + '.amount_total';
        }
        return {
            currency_id: currency_id,
            amount_total: amount_total,
            amount_untaxed: amount_untaxed,
            amount_by_groups: amount_by_groups,
        };
    },
});

return {
    BuildingBlockAddress: BuildingBlockAddress,
    BuildingBlockTable: BuildingBlockTable,
    BuildingBlockTotal: BuildingBlockTotal,
    BuildingFieldComponent: BuildingFieldComponent,
    BuildingImageComponent: BuildingImageComponent,
    BuildingBlockTitle: BuildingBlockTitle,
    BuildingTextComponent: BuildingTextComponent,
};

});
