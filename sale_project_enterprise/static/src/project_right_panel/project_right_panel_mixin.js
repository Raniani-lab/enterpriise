/** @odoo-module **/

import config from 'web.config';
import { patch } from 'web.utils';
import ProjectRightPanel from '@project/js/right_panel/project_right_panel';

if (config.device.isMobile) {
    patch(ProjectRightPanel.prototype, 'sale_project_enterprise.ProjectRightPanel', {
        setup() {
            this._super();
            this.section.sales = {
                closed: true,
            };
        },
    });
}
