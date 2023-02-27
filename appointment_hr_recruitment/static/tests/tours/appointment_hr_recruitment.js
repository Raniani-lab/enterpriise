/** @odoo-module **/

import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

registry.category("web_tour.tours").add('appointment_hr_recruitment_tour', {
    url: '/web',
    test: true,
    steps : [stepUtils.showAppsMenuItem(), {
        trigger: '.o_app[data-menu-xmlid="hr_recruitment.menu_hr_recruitment_root"]',
        run: 'click',
    }, {
        trigger: '.o_kanban_record:contains("Test Job")',
        run: 'click',
    }, {
        trigger: '.o_kanban_record:contains("Test Applicant")',
        run: 'click',
    },{
        trigger: 'button[name="action_makeMeeting"]',
        run: 'click',
    }, {
        trigger: 'button[id="dropdownAppointmentLink"]',
        run: 'click',
    }, {
        trigger: '.o_appointment_button_link:contains("Test AppointmentHrRecruitment")',
        run: 'click',
    }],
});
