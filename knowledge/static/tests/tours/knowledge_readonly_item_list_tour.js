/** @odoo-module */

import tour from 'web_tour.tour';

/**
 * This tour checks that a user that has readonly access on an article cannot
 * create items from the item list.
 */
tour.register('knowledge_readonly_item_list_tour', {
    url: '/web',
    test: true,
}, [tour.stepUtils.showAppsMenuItem(), { // open the Knowledge App
    trigger: '.o_app[data-menu-xmlid="knowledge.knowledge_menu_root"]',
}, { // scroll to the embedded view to load it
    trigger: '.o_knowledge_behavior_type_embedded_view',
    run: function () {
        this.$anchor[0].scrollIntoView();
    },
}, { // wait for the list view to be mounted
    trigger: '.o_knowledge_behavior_type_embedded_view .o_list_renderer',
    run: () => {},
}, { // check that the "new" button is not shown
    trigger: '.o_cp_buttons:not(:has(.o_list_button_add))',
    run: () => {},
}]);
