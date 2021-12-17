/** @odoo-module **/

import { MockModels } from '@mail/../tests/helpers/mock_models';
import { patch } from 'web.utils';

patch(MockModels, 'voip/static/tests/helpers/mock_models.js', {

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    /**
     * @override
     */
    generateData() {
        const data = this._super(...arguments);
        Object.assign(data['mail.activity'].fields, {
            mobile: { string: "Mobile", type: 'char' },
            phone: { string: "Phone", type: 'char' },
        });
        return data;
    },

});
