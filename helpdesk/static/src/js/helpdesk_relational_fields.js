/** @odoo-module **/

import { FieldMany2ManyTags } from 'web.relational_fields';
import FieldRegistry from 'web.field_registry';

const HelpdeskSlaMany2ManyTags = FieldMany2ManyTags.extend({
    fieldsToFetch: Object.assign({}, FieldMany2ManyTags.prototype.fieldsToFetch, {
        status: { type: 'selection', selection: [] },
    }),
    tag_template: "FieldSlaMany2ManyTagIcon",
});

FieldRegistry.add('helpdesk_sla_many2many_tags', HelpdeskSlaMany2ManyTags);
