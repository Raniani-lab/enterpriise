# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from markupsafe import Markup
from odoo.tests.common import tagged, HttpCase
from odoo.tools import mute_logger


@tagged('post_install', '-at_install', 'knowledge_article_template')
class TestKnowledgeArticleTemplate(HttpCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        Article = cls.env["knowledge.article"]
        Category = cls.env["knowledge.article.template.category"]
        Template = cls.env["knowledge.article.template"]

        with mute_logger("odoo.models.unlink"):
            Article.search([]).unlink()
            Template.search([]).unlink()
            Category.search([]).unlink()

        cls.article = Article.create({
            "body": Markup("<p>Hello world</p>"),
            "name": "My Article",
        })

        cls.personal_category = Category.create({
            "name": "Personal"
        })

        cls.template = Template.create({
            "body": Markup("<p>Lorem ipsum dolor sit amet</p>"),
            'icon': 'emoji',
            "category_id": cls.personal_category.id,
            "name": "Template"
        })
        cls.child_template_1 = Template.create({
            "template_properties_definition": [{
                "name": "28db68689e91de10",
                "type": "char",
                "string": "My Text Field",
                "default": ""
            }],
            "body": Markup("<p>Sint dicta facere eum excepturi</p>"),
            "category_id": cls.personal_category.id,
            "name": "Child 1",
            "parent_id": cls.template.id
        })
        cls.child_template_1_1 = Template.create({
            "template_properties": {
                "28db68689e91de10": "Hi there"
            },
            "body": Markup("<p>Magni labore natus, sunt consequatur error</p>"),
            "category_id": cls.personal_category.id,
            "name": "Child 1.1",
            "parent_id": cls.child_template_1.id
        })
        cls.child_template_1_2 = Template.create({
            "body": Markup("<p>Ullam molestias error commodi dignissimos</p>"),
            "category_id": cls.personal_category.id,
            "name": "Child 1.2",
            "parent_id": cls.child_template_1.id
        })
        cls.child_template_2 = Template.create({
            "body": Markup("<p>Voluptate autem officia</p>"),
            "category_id": cls.personal_category.id,
            "name": "Child 2",
            "parent_id": cls.template.id
        })

    def test_apply_template_on_article(self):
        """ Check that that a given template is properly applied to a given article. """
        dummy_article = self.env['knowledge.article'].create({'name': 'NoBody', 'body': False})
        self.template.apply_template_on_article(dummy_article.id, skip_body_update=True)
        self.assertFalse(dummy_article.body)
        self.assertEqual(dummy_article.icon, self.template.icon)

        self.template.apply_template_on_article(self.article.id, skip_body_update=False)

        # After applying the template on the article, the values of the article
        # should have been updated and new child articles should have been created
        # for the article.

        # First level:
        self.assertEqual(self.article.body, Markup("<p>Lorem ipsum dolor sit amet</p>"))
        self.assertEqual(self.article.icon, self.template.icon)

        # Second level:
        [child_article_1, child_article_2] = self.article.child_ids.sorted("name")
        self.assertEqual(child_article_1.article_properties_definition, [{
            "name": "28db68689e91de10",
            "type": "char",
            "string": "My Text Field",
            "default": ""
        }])
        self.assertEqual(child_article_1.body, Markup("<p>Sint dicta facere eum excepturi</p>"))
        self.assertEqual(child_article_2.body, Markup("<p>Voluptate autem officia</p>"))
        self.assertFalse(child_article_2.child_ids)

        # Third level:
        [child_article_1_1, child_article_1_2] = child_article_1.child_ids.sorted("name")
        self.assertEqual(child_article_1_1.article_properties, {
            "28db68689e91de10": "Hi there"
        })
        self.assertEqual(child_article_1_1.body, Markup("<p>Magni labore natus, sunt consequatur error</p>"))
        self.assertFalse(child_article_1_1.child_ids, False)
        self.assertEqual(child_article_1_2.body, Markup("<p>Ullam molestias error commodi dignissimos</p>"))
        self.assertFalse(child_article_1_2.child_ids, False)

    def test_template_category_inheritance(self):
        """ Check that the category of the child templates remain always
            consistent with the root template. """

        new_category = self.env["knowledge.article.template.category"].create({
            "name": "New Category"
        })

        # When the user updates the category of a template having a parent,
        # the category of the template should be reset.

        self.child_template_1.write({
            "category_id": new_category.id
        })
        self.assertEqual(self.template.category_id, self.personal_category)
        self.assertEqual(self.child_template_1.category_id, self.personal_category)
        self.assertEqual(self.child_template_1_1.category_id, self.personal_category)
        self.assertEqual(self.child_template_1_2.category_id, self.personal_category)
        self.assertEqual(self.child_template_2.category_id, self.personal_category)

        # When the user updates the category of the root template, the category
        # of all child templates should be updated.

        self.template.write({
            "category_id": new_category.id
        })
        self.assertEqual(self.template.category_id, new_category)
        self.assertEqual(self.child_template_1.category_id, new_category)
        self.assertEqual(self.child_template_1_1.category_id, new_category)
        self.assertEqual(self.child_template_1_2.category_id, new_category)
        self.assertEqual(self.child_template_2.category_id, new_category)

    def test_template_hierarchy(self):
        """ Check that the templates are properly linked to each other. """
        self.assertFalse(self.article.child_ids)
        # Check 'child_ids' field:
        self.assertEqual(self.template.child_ids, self.child_template_1 + self.child_template_2)
        self.assertEqual(self.child_template_1.child_ids, self.child_template_1_1 + self.child_template_1_2)
        self.assertFalse(self.child_template_2.child_ids)
        # Check 'parent_id' field:
        self.assertFalse(self.template.parent_id)
        self.assertEqual(self.child_template_1.parent_id, self.template)
        self.assertEqual(self.child_template_1_1.parent_id, self.child_template_1)
        self.assertEqual(self.child_template_1_2.parent_id, self.child_template_1)
        self.assertEqual(self.child_template_2.parent_id, self.template)
