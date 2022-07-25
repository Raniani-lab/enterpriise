/** @odoo-module **/

/**
 * Adapt the step that is specific to the work details when the `worksheet` module is not installed.
 */

import tour from 'web_tour.tour';
import 'industry_fsm.tour';

const fillWorkTemplateStepIndex = tour.tours.industry_fsm_tour.steps.findIndex(step => step.id === 'fill_work_template');

tour.tours.industry_fsm_tour.steps[fillWorkTemplateStepIndex].trigger = 'div[name="x_description"] textarea';
