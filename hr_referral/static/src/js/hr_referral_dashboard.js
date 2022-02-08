odoo.define('hr.referral.dashboard', function (require) {
"use strict";

var core = require('web.core');
var KanbanController = require('web.KanbanController');
var KanbanView = require('web.KanbanView');
var view_registry = require('web.view_registry');
const session = require('web.session');

var _lt = core._lt;

var HrReferralDashboardController = KanbanController.extend({
    async willStart() {
        await this._super(...arguments);

        const res = await this._rpc({
            model: 'hr.applicant',
            method: 'retrieve_referral_data',
            context: session.user_context,
        });

        this.show_grass = res.show_grass || false;
    },

    start: function () {
        this.$('.o_content').addClass('o_referral_kanban');
        this.$('.o_content').append('<div class="o_referral_kanban_background"/>');

        const company_id = session.user_context.allowed_company_ids[0];
        if (company_id !== undefined && Number.isInteger(company_id)) {
            this.$('.o_referral_kanban_background').css('background-image', `url('/web/image/res.company/${company_id}/hr_referral_background')`);
        }

        if (this.show_grass) {
            this.$('.o_referral_kanban_background').append('<div class="hr_referral_bg_city"/>');
            this.$('.o_referral_kanban_background').append('<div class="hr_referral_bg_grass"/>');
        }

        return this._super.apply(this, arguments);
    }
});

var HrReferralDashboardView = KanbanView.extend({
    config: _.extend({}, KanbanView.prototype.config, {
        Controller: HrReferralDashboardController,
    }),
    display_name: _lt('Dashboard'),
    icon: 'fa-dashboard',
});

view_registry.add('employee_referral_dashboard', HrReferralDashboardView);

return {
    Controller: HrReferralDashboardController,
};

});
