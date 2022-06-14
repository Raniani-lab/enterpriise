/** @odoo-module */

import { getFixture } from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";

let target;
let serverData;


const getArch = function (){
return '<kanban class="o_social_stream_post_kanban"' +
    '    create="0"' +
    '    edit="0"' +
    '    records_draggable="false"' +
    '    group_create="false"' +
    '    js_class="social_stream_post_kanban_view">' +
    '    <field name="id"/>' +
    '    <field name="author_name"/>' +
    '    <field name="author_link"/>' +
    '    <field name="post_link"/>' +
    '    <field name="published_date"/>' +
    '    <field name="formatted_published_date"/>' +
    '    <field name="message"/>' +
    '    <field name="media_type"/>' +
    '    <field name="account_id"/>' +
    '    <field name="link_url"/>' +
    '    <field name="link_image_url"/>' +
    '    <field name="link_title"/>' +
    '    <field name="link_description"/>' +
    '    <field name="stream_post_image_ids"/>' +
    '    <field name="stream_post_image_urls"/>' +
    '    <field name="stream_id" readonly="1"/>' +
    '    <field name="facebook_author_id"/>' +
    '    <field name="facebook_likes_count"/>' +
    '    <field name="facebook_user_likes"/>' +
    '    <field name="facebook_comments_count"/>' +
    '    <field name="facebook_shares_count"/>' +
    '    <field name="facebook_reach"/>' +
    '    <field name="facebook_page_id"/>' +
    '    <templates>' +

'<t t-name="kanban-box">' +
'	<div class="o_social_stream_post_kanban_global p-0 mb-3">' +
'		<div class="o_social_stream_post_message py-2">' +
'			<div class="d-flex justify-content-between mb-2 px-2">' +
'				<t t-set="author_info">' +
'					<span class="o_social_stream_post_author_image o_social_author_image position-relative rounded-circle overflow-hidden"/>' +
'					<span class="o_social_stream_post_author_name text-truncate ms-2" t-esc="record.author_name.value or \'Unknown\'" t-att-title="record.author_name.value or \'Unknown\'"/>' +
'				</t>' +
'' +
'				<div class="o_social_author_information d-flex align-items-center">' +
'					<a t-if="record.author_link.value"' +
'						class="o_social_stream_post_author d-flex align-items-center"' +
'						t-att-href="record.author_link.value"' +
'						t-att-title="record.author_name.value or \'Unknown\'"' +
'						t-out="author_info"' +
'						target="_blank"/>' +
'' +
'					<div t-else=""' +
'						class="o_social_stream_post_author d-flex align-items-center"' +
'						t-out="author_info"/>' +
'				</div>' +
'' +
'				<a t-att-href="record.post_link.value" target="_blank">' +
'					<time class="o_social_stream_post_published_date small"' +
'						t-esc="record.formatted_published_date.value"' +
'						t-att-title="record.published_date.value"/>' +
'				</a>' +
'			</div>' +
'			<div name="o_social_stream_post_message_body"' +
'				class="o_social_stream_post_message_body px-2 pb-2 mb-2 border-bottom}">' +
'' +
'				<div class="o_social_stream_post_message_text overflow-hidden mb-2">' +
'					<div t-if="record.message.raw_value" t-out="formatPost(record.message.value)"/>' +
'				</div>' +
'			</div>' +
'           <div class="o_social_stream_post_facebook_stats px-2 d-flex justify-content-around"' +
'           	t-if="record.media_type.raw_value === \'facebook\'">' +
'           	<div t-attf-class="o_social_facebook_likes o_social_subtle_btn ps-2 pe-3 #{record.facebook_user_likes.raw_value ? \'o_social_facebook_user_likes\' : \'\'}"' +
'            		t-on-click.stop="_onFacebookPostLike">' +
'            		<t t-if="record.facebook_likes_count.raw_value !== 0">' +
'            			<i class="fa fa-thumbs-up me-1" title="Likes"/>' +
'            			<b class="o_social_kanban_likes_count" t-esc="_insertThousandSeparator(record.facebook_likes_count.raw_value)"/>' +
'            		</t>' +
'            	</div>' +
'            	<div class="o_social_facebook_comments o_social_comments o_social_subtle_btn px-3"' +
'            		 t-on-click.stop="_onFacebookCommentsClick">' +
'            		<i class="fa fa-comments me-1" title="Comments"/>' +
'            		<b t-esc="record.facebook_comments_count.value !== \'0\' ? record.facebook_comments_count.value : \'\'"/>' +
'            	</div>' +
'            	<div class="flex-grow-1 d-flex text-muted justify-content-end">' +
'            		<div>' +
'            			<t t-esc="record.facebook_shares_count.value"/>' +
'            			Shares' +
'            		</div>' +
'            		<div class="ms-3">' +
'            			<t t-esc="record.facebook_reach.value"/>' +
'            			Views' +
'            		</div>' +
'            	</div>' +
'            </div>' +
'		</div>' +
'	</div>' +
'</t>' +
    '    </templates>' +
    '</kanban>';
};

QUnit.module('Facebook Comments', (hooks) => {
    hooks.beforeEach(() => {
        target = getFixture();
        serverData = {
            models: {
                'social.media': {
                    fields: {
                        id: {type: 'integer'},
                        name: {type: 'char'},
                        has_streams: {type: 'boolean'},
                    },
                    records: [{
                        id: 1,
                        name: 'Facebook',
                        has_streams: true,
                    }]
                },
                'social.account': {
                    fields: {
                        id: {type: 'integer'},
                        name: {type: 'char'},
                        is_media_disconnected: {type: 'boolean'},
                        facebook_account_id: {type: 'char'},
                        audience: {type: 'integer'},
                        audience_trend: {type: 'double'},
                        engagement: {type: 'integer'},
                        engagement_trend: {type: 'double'},
                        stories: {type: 'integer'},
                        stories_trend: {type: 'double'},
                        has_account_stats: {type: 'boolean'},
                        has_trends: {type: 'boolean'},
                        stats_link: {type: 'char'},
                        image: {type: 'image'},
                        media_id: {
                            string: 'Media',
                            type: 'many2one',
                            relation: 'social.media'
                        },
                        media_type: {type: 'char'},
                    },
                    records: [{
                        id: 1,
                        name: 'Jack\'s Page',
                        is_media_disconnected: false,
                        has_account_stats: true,
                        has_trends: true,
                        audience: 519,
                        audience_trend: 50,
                        engagement: 6000,
                        engagement_trend: 60,
                        stories: 70000,
                        stories_trend: -20,
                        stats_link: 'facebook.com/jack',
                        media_id: 1,
                        media_type: 'facebook',
                    }, {
                        id: 2,
                        name: 'Jhon\'s Page',
                        has_account_stats: true,
                        has_trends: false,
                        audience: 400,
                        audience_trend: 0,
                        engagement: 400,
                        engagement_trend: 0,
                        stories: 4000,
                        stories_trend: 0,
                        stats_link: 'facebook.com/jhon',
                        media_id: 1,
                        media_type: 'facebook',
                    }]
                },
                social_stream: {
                    fields: {
                        id: {type: 'integer'},
                        name: {type: 'char'},
                        media_id: {
                            string: 'Media',
                            type: 'many2one',
                            relation: 'social.media'
                        }
                    },
                    records: [{
                        id: 1,
                        name: 'Stream 1',
                        media_id: 1
                    }, {
                        id: 2,
                        name: 'Stream 2',
                        media_id: 1
                    }]
                },
                social_stream_post_image: {
                    fields: {
                        id: {type: 'integer'},
                        image_url: {type: 'char'}
                    }
                },
                social_stream_post: {
                    fields: {
                        id: {type: 'integer'},
                        name: {type: 'char'},
                        author_name: {type: 'char'},
                        author_link: {type: 'char'},
                        post_link: {type: 'char'},
                        published_date: {type: 'datetime'},
                        formatted_published_date: {type: 'char'},
                        message: {type: 'text'},
                        media_type: {type: 'char'},
                        link_url: {type: 'char'},
                        link_image_url: {type: 'char'},
                        link_title: {type: 'char'},
                        link_description: {type: 'char'},
                        stream_post_image_urls: {type: 'char'},
                        facebook_author_id: {type: 'integer'},
                        facebook_likes_count: {type: 'integer'},
                        facebook_user_likes: {type: 'boolean'},
                        facebook_comments_count: {type: 'integer'},
                        facebook_shares_count: {type: 'integer'},
                        facebook_reach: {type: 'integer'},
                        stream_post_image_ids: {
                            string: 'Stream Post Images',
                            type: 'one2many',
                            relation: 'social_stream_post_image'
                        },
                        stream_id: {
                            string: 'Stream',
                            type: 'many2one',
                            relation: 'social_stream'
                        },
                        facebook_page_id: {
                            string: 'Facebook Page',
                            type: 'many2one',
                            relation: 'social.account'
                        },
                        account_id: {
                            string: 'Account',
                            type: 'many2one',
                            relation: 'social.account'
                        }
                    },
                    records: [{
                        id: 1,
                        author_name: 'Jhon',
                        post_link: 'www.odoosocial.com/link1',
                        author_link: 'www.odoosocial.com/author1',
                        published_date: "2019-08-20 14:16:00",
                        formatted_published_date: "2019-08-20 14:16:00",
                        message: 'Message 1 Youtube',
                        media_type: 'facebook',
                        link_url: 'blog.com/odoosocial',
                        link_title: 'Odoo Social',
                        link_description: 'Odoo Social Description',
                        facebook_author_id: 1,
                        facebook_likes_count: 5,
                        facebook_user_likes: true,
                        facebook_comments_count: 15,
                        facebook_shares_count: 3,
                        facebook_reach: 18,
                        facebook_page_id: 1,
                        account_id: 1,
                        stream_id: 1
                    }, {
                        id: 2,
                        author_name: 'Jack',
                        post_link: 'www.odoosocial.com/link2',
                        author_link: 'www.odoosocial.com/author2',
                        published_date: "2019-08-20 14:17:00",
                        formatted_published_date: "2019-08-20 14:17:00",
                        message: 'Message 2 Images',
                        media_type: 'facebook',
                        facebook_author_id: 2,
                        facebook_likes_count: 10,
                        facebook_user_likes: false,
                        facebook_comments_count: 25,
                        facebook_shares_count: 4,
                        facebook_page_id: 1,
                        account_id: 1,
                        facebook_reach: 33,
                        stream_id: 2
                    }, {
                        id: 3,
                        author_name: 'Michel',
                        post_link: 'www.odoosocial.com/link3',
                        author_link: 'www.odoosocial.com/author3',
                        published_date: "2019-08-20 14:18:00",
                        formatted_published_date: "2019-08-20 14:18:00",
                        message: 'Message 3',
                        media_type: 'facebook',
                        facebook_author_id: 3,
                        facebook_likes_count: 0,
                        facebook_user_likes: false,
                        facebook_comments_count: 0,
                        facebook_shares_count: 0,
                        facebook_page_id: 1,
                        account_id: 1,
                        facebook_reach: 42,
                        stream_id: 2
                    }]
                }
            }
        }

        setupViewRegistries();
    });

    QUnit.test('Check accounts statistics', async function (assert) {
        assert.expect(7);

        await makeView({
            type: "form",
            resModel: 'social_stream_post',
            serverData,
            arch: getArch(),
            mockRPC(route, params) {
                if (params.method === 'refresh_all') {
                    assert.ok(true);
                    return {};
                } else if (params.method === 'refresh_statistics') {
                    assert.ok(true);
                    var records = serverData.models['social.account'].records.slice();
                    for(var i = 0; i < records.length; i++){
                        if (!Array.isArray(records[i].media_id)) {
                            records[i].media_id = [records[i].media_id, 'Facebook'];
                        }
                    }
                    return records;
                } else if(route.startsWith('https://graph.facebook.com/')) {
                    return '';
                }
            },
        });

        assert.containsN(target, ".o_social_stream_stat_box", 2,
            "Kanban View should contain exactly 2 lines of account statistics.");

        // 3 because '50%' counts as a match (and 60M, and -20%)
        // so if we want to check that there are no actual 0%, it means we want only 3 times "contains 0%"
        assert.containsN(target, ".o_social_stream_stat_box small:contains('0%')", 3,
            "Accounts with has_trends = false should not display trends.");

        assert.containsOnce(target, ".o_social_stream_stat_box b:contains('519')",
            "Audience is correctly displayed.");

        assert.containsOnce(target, ".o_social_stream_stat_box small:contains('50%')",
            "Audience trend is correctly displayed.");
    });

    // TODO awa: re-instate test of facebook comments, currently broken in OWL
});
