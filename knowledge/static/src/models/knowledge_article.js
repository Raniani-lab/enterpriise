/** @odoo-module **/

import { attr, registerModel } from '@mail/model';

/**
 * Models a knowledge article.
 */
registerModel({
    name: 'KnowledgeArticle',
    fields: {
        id: attr({
            identifying: true,
        }),
    },
});
