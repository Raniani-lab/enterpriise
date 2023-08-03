/** @odoo-module */


import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { HotkeyCommandItem } from "@web/core/commands/default_providers";
import { splitCommandName } from "@web/core/commands/command_palette";
import { sprintf } from '@web/core/utils/strings';
import { Component } from "@odoo/owl";

// Articles command
class KnowledgeCommand extends Component {}
KnowledgeCommand.template = 'KnowledgeCommandTemplate';

// "Not found, create one" command
class Knowledge404Command extends Component {}
Knowledge404Command.template = 'Knowledge404CommandTemplate';

// Advanced search command
class KnowledgeExtraCommand extends HotkeyCommandItem {}
KnowledgeExtraCommand.template = 'KnowledgeExtraCommandTemplate';

const commandSetupRegistry = registry.category("command_setup");
commandSetupRegistry.add("?", {
    debounceDelay: 200,
    emptyMessage: _t("No article found."),
    name: _t("articles"),
    placeholder: _t("Search for an article..."),
});

const commandProviderRegistry = registry.category("command_provider");

const fn = (hidden) => {
    return async function provide(env, options) {
        const articlesData = await env.services.orm.call(
            "knowledge.article",
            "get_user_sorted_articles",
            [[]],
            {
                search_query: options.searchValue,
                hidden_mode: hidden,
            }
        );
        if (!hidden){
            if (articlesData.length === 0) {
                // check if user has enough rights to create a new article
                const canCreate = await env.services.orm.call(
                    "knowledge.article",
                    "check_access_rights",
                    [],
                    {
                        operation: "create",
                        raise_exception: false,
                    },
                );
                // only display the "create article" command when there are at least 3 character
                if (canCreate && options.searchValue.length > 2) {
                    return [{
                        Component: Knowledge404Command,
                        async action() {
                            const articleId = await env.services.orm.call(
                                'knowledge.article',
                                'article_create',
                                [options.searchValue],
                                {
                                    is_private: true
                                },
                            );

                            env.services.action.doAction('knowledge.ir_actions_server_knowledge_home_page', {
                                additionalContext: {
                                    res_id: articleId,
                                }
                            });
                        },
                        name: sprintf(_t('No Article found. Create "%s"'), options.searchValue),
                        props: {
                            articleName: options.searchValue,
                        },
                    }];
                }
                else {
                    return [];
                }
            }
        }
        const knowledgeMainMenuId = env.services.menu.getAll().find(
            menu => menu.xmlid === 'knowledge.knowledge_menu_root'
        ).id;
        // display the articles
        const result = articlesData.map(article => ({
            Component: KnowledgeCommand,
            action() {
                env.services.action.doAction('knowledge.ir_actions_server_knowledge_home_page', {
                    additionalContext: {
                        res_id: article.id,
                    }
                });

            },
            category: "knowledge_articles",
            href: `/web#id=${article.id}&model=knowledge.article&view_type=form&menu_id=${knowledgeMainMenuId}`,
            name: article.name || _t("Untitled"),
            props: {
                isFavorite: article.is_user_favorite,
                subjectName: article.root_article_id[0] != article.id ? article.root_article_id[1] : false,
                splitSubjectName: splitCommandName(article.root_article_id[1], options.searchValue),
                icon_string: article.icon || '📄',
            },
        }));
        if(!hidden){
        // add the "advanced search" command
            result.push({
                Component: KnowledgeExtraCommand,
                action() {
                    env.services.action.doAction('knowledge.knowledge_article_action', {
                        additionalContext: {
                            search_default_name: options.searchValue,
                        },
                    });
                },
                category: "knowledge_extra",
                name: _t("Advanced Search"),
                props: {
                    hotkey: "alt+B",
                },
            });
        }
        return result;
    };
};

commandProviderRegistry.add("knowledge", {
    debounceDelay: 200,
    namespace: "?",
    provide: fn(false),
});

commandSetupRegistry.add("$", {
    debounceDelay: 200,
    emptyMessage: _t("No hidden articles found"),
    placeholder: _t("Search a hidden article to join"),
});
commandProviderRegistry.add("knowledge_members_only_articles", {
    debounceDelay: 200,
    namespace: "$",
    provide: fn(true),
});
