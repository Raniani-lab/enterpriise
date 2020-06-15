odoo.define('hr_appraisal.appraisal_kanban', function (require) {
'use strict';

const viewRegistry = require('web.view_registry');
const KanbanController = require('web.KanbanController');
const KanbanView = require('web.KanbanView');
const KanbanRenderer = require('web.KanbanRenderer');
const KanbanRecord = require('web.KanbanRecord');
const session = require('web.session');
const { _t } = require('web.core');

const { Component } = owl;

const AppraisalKanbanRecord = KanbanRecord.extend({
    _render: async function () {
        const self = this;
        await this._super.apply(this, arguments);
        _.each(this.$el.find('.o_appraisal_manager'), employee => {
            $(employee).on('click', self._onOpenChat.bind(self));
        });
    },

    _onOpenChat: function(ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        this.trigger_up('open_chat', {
            employee_id: $(ev.target).data('id')
        });
    },
});

const AppraisalKanbanRenderer = KanbanRenderer.extend({
    config: Object.assign({}, KanbanRenderer.prototype.config, {
        KanbanRecord: AppraisalKanbanRecord,
    }),
});

const AppraisalKanbanController = KanbanController.extend({
    custom_events: _.extend({}, KanbanController.prototype.custom_events, {
        open_chat: '_onOpenChat'
    }),

    _onOpenChat: async function (ev) {
        const partner_data = await this._rpc({
            model: 'hr.employee.public',
            method: 'read',
            args: [[ev.data.employee_id], ['user_partner_id']],
        });
        const partnerId = partner_data[0].user_partner_id[0];
        if (partnerId && partnerId !== session.partner_id) {
            const env = Component.env;
            const partner = env.models['mail.partner'].insert({
                id: partner_data[0].id,
            });
            partner.openChat();
        } else if (partnerId !== session.partner_id) {
            // this is not ourself, so if we get here it means that the
            // employee is not associated with any user
            this.displayNotification({
                message: _t('You can only chat with employees that have a dedicated user'),
                type: 'info',
            });
        } else {
            this.displayNotification({
                message: _t('You cannot chat with yourself'),
                type: 'info',
            });
        }
    },
});

const AppraisalKanbanView = KanbanView.extend({
    config: _.extend({}, KanbanView.prototype.config, {
        Controller: AppraisalKanbanController,
        Renderer: AppraisalKanbanRenderer,
    }),
});

viewRegistry.add('appraisal_kanban', AppraisalKanbanView);
return {
    AppraisalKanbanView: AppraisalKanbanView,
    AppraisalKanbanController: AppraisalKanbanController,
    AppraisalKanbanRecord: AppraisalKanbanRecord,
    AppraisalKanbanRenderer: AppraisalKanbanRenderer,
};
});
