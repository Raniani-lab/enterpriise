odoo.define('mrp_workorder.update_kanban', function (require) {
"use strict";

var field_registry = require('web.field_registry');
var KanbanController = require('web.KanbanController');
var KanbanView = require('web.KanbanView');
var view_registry = require('web.view_registry');
var ListController = require('web.ListController');
var ListView = require('web.ListView');

const { qweb } = require('web.core');
const { FieldInteger } = require('web.basic_fields');

var BackArrow = FieldInteger.extend({
    events: {
        'click': '_onClick',
    },
    _render: function () {
        this.$el.html('<button class="btn btn-secondary o_workorder_icon_btn o_workorder_icon_back"><i class="fa fa-arrow-left"/></button>');
    },
    _onClick: function () {
        var self = this;
        this._rpc({
            method: 'action_back',
            model: 'mrp.workorder',
            args: [self.recordData.id],
        }).then(function (result) {
            self.trigger_up('history_back');
        });
    },
});

function tabletRenderButtons($node) {
    this.$buttons = $(qweb.render('mrp_workorder.overviewButtons'), { widget: this });
    this.$buttons.find('.o_back_button').on('click', () => {
        this.do_action('mrp.mrp_workcenter_kanban_action', { clear_breadcrumbs: true });
    });
    if ($node) {
        this.$buttons.appendTo($node);
    }
}

var TabletKanbanController = KanbanController.extend({
    renderButtons: function () {
        this._super.apply(this, arguments);
        tabletRenderButtons.apply(this, arguments);
    },

    _onOpenRecord: async function (ev) {
        ev.stopPropagation();
        const additional_context = Object.assign({ active_id: ev.target.id }, ev.data.context || {});
        const action = await this._rpc({
            method: 'open_tablet_view',
            model: 'mrp.workorder',
            args: [ev.target.recordData.id],
        });
        this.do_action(action, { additional_context: additional_context });
    },
});

var TabletKanbanView = KanbanView.extend({
    config: _.extend({}, KanbanView.prototype.config, {
        Controller: TabletKanbanController,
    }),
});

var TabletListController = ListController.extend({
    renderButtons: function () {
        this._super(...arguments);
        return tabletRenderButtons.apply(this, arguments);
    },
});

var TabletListView = ListView.extend({
    config: _.extend({}, ListView.prototype.config, {
        Controller: TabletListController,
    }),
});

field_registry.add('back_arrow', BackArrow);
view_registry.add('tablet_kanban_view', TabletKanbanView);
view_registry.add('tablet_list_view', TabletListView);

return {
    BackArrow: BackArrow,
    TabletKanbanView: TabletKanbanView,
    TabletListView: TabletListView,
    TabletKanbanController,
};
});
