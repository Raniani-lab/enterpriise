/** @odoo-module **/

import { registry } from '@web/core/registry';

const viewArchsRegistry = registry.category('mail.view.archs');

viewArchsRegistry.category('form').add(
    'approval.request',
    `<form>
        <div class="oe_chatter">
            <field name="activity_ids"/>
        </div>
    </form>`
);
