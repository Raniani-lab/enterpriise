/** @odoo-module **/

import { attr, Model } from '@mail/model';

/**
 * Models a knowledge article.
 */
Model({
    name: 'KnowledgeArticle',
    fields: {
        id: attr({
            identifying: true,
        }),
    },
});
