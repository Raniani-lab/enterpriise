odoo.define('documents.Many2ManyColorWidget', function (require) {
    'use strict';

    const fieldRegistry = require('web.field_registry');

    const { FieldMany2ManyTags } = require('web.relational_fields');

    const Many2ManyColorWidget = FieldMany2ManyTags.extend({

        /**
         * @override
         */
        async start() {
            this.trigger_up('get_search_panel_tags', {callback: val => {this.tags = val;}});
            await this._super(...arguments);
        },
        /**
         * @override
         * @private
         */
        _render() {
            this.$el.empty().addClass('o_field_many2manytags o_kanban_tags');
            const tagIDs = this.value.data.map(m2m => m2m.data.id);
            for (const tag of this.tags) {
                if (tagIDs.includes(tag.id)) {
                    const color = tag.group_hex_color || '#00000022';
                    $('<span>', {
                        class: 'o_tag',
                        text: tag.name,
                        title: tag.group_name + ' > ' + tag.name,
                    })
                    .prepend($('<span>', {
                        style: 'color: ' + color + ';',
                        text: '●',
                    }))
                    .appendTo(this.$el);
                }
            }
        },
    });

    fieldRegistry.add('documents_many2many_tags', Many2ManyColorWidget);

});
