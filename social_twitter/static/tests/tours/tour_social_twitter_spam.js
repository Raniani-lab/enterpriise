odoo.define('social_twitter/static/tests/tours/tour_social_twitter_spam.js', function (require) {
'use strict';

const tour = require('web_tour.tour');

function makeEnterEvent() {
    let enterEvent = jQuery.Event('keydown');
    enterEvent.which = $.ui.keyCode.ENTER;
    enterEvent.keyCode = $.ui.keyCode.ENTER;
    return enterEvent;
}

function createReplies(textareaSelector) {
    const maximumAllowedReplies = 3;
    const randomSeed = Math.random();

    let tourSteps = [];

    // must be able to post "maximumAllowedReplies" replies
    for (let i = 0; i < maximumAllowedReplies; i++) {
        const message = `__social_twitter_test_tour_${randomSeed}_${i}__`;

        tourSteps.push(
            {
                trigger: '.o_social_comments_modal textarea',
                content: `Reply number ${i}`,
                run: () => {
                    const $inputComment = $(textareaSelector);
                    $inputComment.val(message);
                    $inputComment.trigger(makeEnterEvent());
                }
            },
            {
                trigger: `.o_social_comment_text[data-original-message*="${message}"]`,
                content: 'Check if the comment has been posted',
            },
        );
    }

    // the next reply must fail
    const message = `__social_twitter_test_tour_${randomSeed}_last__`;
    tourSteps.push(
        {
            trigger: '.o_social_comments_modal textarea',
            content: 'Write the last comment that will fail',
            run: () => {
                const $inputComment = $(textareaSelector);
                $inputComment.val(message);
                $inputComment.trigger(makeEnterEvent());
            },
        },
        {
            trigger: '.o_social_comments_modal',
            content: 'Should not be able to spam',
            run: () => {
                const $fourthComment = $(`.o_social_comment_text[data-original-message*="${message}"]`);
                if ($fourthComment.length) {
                    console.error('Should not be able to spam');
                }
            },
        },
    );

    return tourSteps;
}

/**
  * Twitter has a spam detection and will take measures against spamming accounts.
  * We now have a spam check mechanism to prevent any potential issues.
  * This will test that:
  * - Users can't spam when replying to a stream.post
  * - Users can't spam when replying to another comment (on a stream.post)
  *
  * The spam detection is set to maximum 3 comments.
  **/
tour.register(
    'social_twitter/static/tests/tours/tour_social_twitter_spam.js',
    {
        url: '/web',
        test: true,
    },
    [
        {
            trigger: '.o_app[data-menu-xmlid="social.menu_social_global"]',
            content: 'Open the Social App',
            run: 'click',
        },
        {
            trigger: '.o_social_stream_post_message',
            content: 'Open the tweet comments',
            run: 'click',
        },
        // Test comments spam
        ...createReplies('.o_social_comments_modal textarea.o_social_add_comment:not([data-is-comment-reply])'),
        // Test replies spam
        ...createReplies('.o_social_comment:first textarea[name="message"]'),
    ]
);
});
