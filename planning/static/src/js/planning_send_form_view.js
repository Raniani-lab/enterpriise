/** @odoo-module alias=planning.PlanningSendFormView **/

import view_registry from 'web.view_registry';
import FormView from 'web.FormView';
import Model from './planning_send_form_model';

const PlanningSendFormView = FormView.extend({
    config: Object.assign({}, FormView.prototype.config, {
        Model
    }),
});

view_registry.add('planning_send_form', PlanningSendFormView);

export default PlanningSendFormView;
