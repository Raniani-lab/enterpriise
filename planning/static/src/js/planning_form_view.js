/** @odoo-module **/

import { _t } from 'web.core';
import { Markup } from 'web.utils';

import FormView from 'web.FormView';
import FormController from 'web.FormController';
import viewRegistry from 'web.view_registry';

const PlanningFormController = FormController.extend({
    /**
     * @override
     * @returns {Object}
     */
    async saveRecord() {
        const changedFields = await this._super(...arguments);
        if (changedFields.includes('repeat')) {
            const rendererData = this.renderer.state.data;
            if (rendererData.repeat && this.initialState.data.repeat != rendererData.repeat) {
                const message = _t("The recurring shifts have successfully been created.");
                this.displayNotification({
                    type: 'success',
                    message: Markup`<i class="fa fa-fw fa-check"></i><span class="ms-1">${message}</span>`,
                });
            }
        }
        return changedFields;
    },
});


export const PlanningFormView = FormView.extend({
    config: Object.assign({}, FormView.prototype.config, {
        Controller: PlanningFormController,
    }),
});

viewRegistry.add('planning_form', PlanningFormView);
