/** @odoo-module **/

/**
 * Adapt the step that is specific to the work details when the `worksheet` module is not installed.
 */

import tour from 'web_tour.tour';
import 'industry_fsm.tour';

const fillWorkTemplateStepIndex = tour.tours.industry_fsm_tour.steps.findIndex(step => step.id === 'fill_work_template');

tour.tours.industry_fsm_tour.steps[fillWorkTemplateStepIndex].trigger = 'div[name="x_description"] textarea';

const signReportStepIndex = tour.tours.industry_fsm_tour.steps.findIndex(step => step.id === 'sign_report');

tour.tours.industry_fsm_tour.steps.splice(signReportStepIndex, 0, {
    trigger: 'div[name="worksheet_map"] h5#task_worksheet',
    extra_trigger: '.o_project_portal_sidebar',
    content: ('"Worksheet" section is rendered'),
    auto: true,
}, {
    trigger: 'div[name="worksheet_map"] div[class*="row"] div:contains("Manufacturer")',
    extra_trigger: '.o_project_portal_sidebar',
    content: ('"Manufacturer"" is rendered'),
    auto: true,
}, {
    trigger: 'div[name="worksheet_map"] div[class*="row"] div:contains("Serial Number")',
    extra_trigger: '.o_project_portal_sidebar',
    content: ('"Serial Number" is rendered'),
    auto: true,
}, {
    trigger: 'div[name="worksheet_map"] div[class*="row"] div:contains("Intervention Type")',
    extra_trigger: '.o_project_portal_sidebar',
    content: ('"Intervention Type" is rendered'),
    auto: true,
}, {
    trigger: 'div[name="worksheet_map"] div[class*="row"] div:contains("Description of the Intervention")',
    extra_trigger: '.o_project_portal_sidebar',
    content: ('"Description of the Intervention" is rendered'),
    auto: true,
}, {
    trigger: 'div[name="worksheet_map"] div[class*="row"] div:contains("I hereby certify that this device meets the requirements of an acceptable device at the time of testing.")',
    extra_trigger: '.o_project_portal_sidebar',
    content: ('"I hereby certify..." is rendered'),
    auto: true,
}, {
    trigger: 'div[name="worksheet_map"] div[class*="row"] div:contains("Date")',
    extra_trigger: '.o_project_portal_sidebar',
    content: ('"Date" is rendered'),
    auto: true,
}, {
    trigger: 'div[name="worksheet_map"] div[class*="row"] div:contains("Worker Signature")',
    extra_trigger: '.o_project_portal_sidebar',
    content: ('"Worker Signature" is rendered'),
    auto: true,
});
