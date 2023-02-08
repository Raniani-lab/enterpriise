/** @odoo-module */

import tour from 'web_tour.tour';

// Checks that one can add an readonly article to its favorites

tour.register('knowledge_readonly_favorite_tour', {
    test: true,
}, [{
    // Make sure we are on the readonly article, that is not favorited, and
    // click on the toggle favorite button.
    trigger: 'a.o_toggle_favorite:has(.fa-star-o)',
    extra_trigger: '.o_article_active:contains("Readonly Article")',
}, {
    // Check that the article has been added to the favorites
    trigger: 'section.o_favorite_container:contains(Readonly Article)',
    extra_trigger: 'a.o_toggle_favorite:has(.fa-star)',
    run: () => {},
}]);
